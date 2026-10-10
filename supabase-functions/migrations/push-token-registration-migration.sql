-- =========================================================
-- Scholin: let the app save each phone's notification token. (version 2, safe to run again)
-- Run once in the Supabase SQL editor.
--
-- The app saves its token in your existing push_tokens table, the same table the
-- send-push-notification function reads. This works out your column names itself
-- (user_id or profile_id, token or fcm_token, platform, school_id) so it fits the table
-- your HTML app already uses. If the table has a school_id column, the person's first school is filled in.
-- =========================================================
create or replace function register_push_token(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cols text[];
  v_user_col text;
  v_token_col text;
  v_platform_col text;
  v_has_school boolean;
  v_school uuid;
  v_names text;
  v_vals text;
  v_flag text;
  v_rows int := 0;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  if p_token is null or length(p_token) < 20 then
    raise exception 'Invalid token';
  end if;

  select array_agg(column_name::text) into v_cols
    from information_schema.columns where table_schema = 'public' and table_name = 'push_tokens';
  if v_cols is null then
    raise exception 'The push_tokens table does not exist';
  end if;

  v_user_col := case when 'user_id' = any(v_cols) then 'user_id' when 'profile_id' = any(v_cols) then 'profile_id' end;
  v_token_col := case when 'token' = any(v_cols) then 'token' when 'fcm_token' = any(v_cols) then 'fcm_token' when 'device_token' = any(v_cols) then 'device_token' end;
  v_platform_col := case when 'platform' = any(v_cols) then 'platform' when 'device_type' = any(v_cols) then 'device_type' when 'device' = any(v_cols) then 'device' end;
  v_has_school := 'school_id' = any(v_cols);

  if v_user_col is null or v_token_col is null then
    raise exception 'push_tokens has these columns: %. It needs a user column (user_id or profile_id) and a token column (token or fcm_token).', array_to_string(v_cols, ', ');
  end if;

  -- A phone belongs to whoever is signed in on it now.
  execute format('delete from push_tokens where %I = $1', v_token_col) using p_token;

  -- One row per person and phone. (The table is unique on person + token, so one row is all that fits.)
  v_names := format('%I, %I', v_user_col, v_token_col);
  v_vals := format('%L, %L', v_uid, p_token);
  if v_platform_col is not null then
    v_names := v_names || format(', %I', v_platform_col);
    v_vals := v_vals || format(', %L', p_platform);
  end if;
  foreach v_flag in array array['is_active', 'active', 'enabled'] loop
    if v_flag = any(v_cols) then
      v_names := v_names || format(', %I', v_flag);
      v_vals := v_vals || ', true';
    end if;
  end loop;
  if v_has_school then
    select school_id into v_school from school_members where profile_id = v_uid and is_active = true limit 1;
    if v_school is not null then
      v_names := v_names || ', school_id';
      v_vals := v_vals || format(', %L', v_school);
    end if;
  end if;

  begin
    execute 'insert into push_tokens (' || v_names || ') values (' || v_vals || ')';
  exception when unique_violation then
    -- The table allows only one row per person (or per person and platform), so this phone replaces the old one.
    -- Only rows of the same platform are changed, so another device (for example the web app) is left alone.
    if v_platform_col is not null then
      execute format('update push_tokens set %I = $1 where %I = $2 and %I::text = $3', v_token_col, v_user_col, v_platform_col) using p_token, v_uid, p_platform;
      get diagnostics v_rows = row_count;
    end if;
    if v_rows = 0 then
      -- No row of this platform: the table keeps one row per person, so replace that row.
      execute format('update push_tokens set %I = $1 where %I = $2', v_token_col, v_user_col) using p_token, v_uid;
    end if;
  end;
end;
$$;

create or replace function unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cols text[];
  v_user_col text;
  v_token_col text;
begin
  if v_uid is null then
    return;
  end if;
  select array_agg(column_name::text) into v_cols
    from information_schema.columns where table_schema = 'public' and table_name = 'push_tokens';
  if v_cols is null then
    return;
  end if;
  v_user_col := case when 'user_id' = any(v_cols) then 'user_id' when 'profile_id' = any(v_cols) then 'profile_id' end;
  v_token_col := case when 'token' = any(v_cols) then 'token' when 'fcm_token' = any(v_cols) then 'fcm_token' when 'device_token' = any(v_cols) then 'device_token' end;
  if v_user_col is null or v_token_col is null then
    return;
  end if;
  execute format('delete from push_tokens where %I = $1 and %I = $2', v_token_col, v_user_col) using p_token, v_uid;
end;
$$;

-- Used by the app's "Notification check" screen to show whether this phone's token reached the server.
create or replace function my_push_token_status(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cols text[];
  v_user_col text;
  v_token_col text;
  v_mine int := 0;
  v_this int := 0;
begin
  select array_agg(column_name::text) into v_cols
    from information_schema.columns where table_schema = 'public' and table_name = 'push_tokens';
  if v_cols is null then
    return jsonb_build_object('table_exists', false);
  end if;
  v_user_col := case when 'user_id' = any(v_cols) then 'user_id' when 'profile_id' = any(v_cols) then 'profile_id' end;
  v_token_col := case when 'token' = any(v_cols) then 'token' when 'fcm_token' = any(v_cols) then 'fcm_token' when 'device_token' = any(v_cols) then 'device_token' end;
  if v_user_col is not null and v_uid is not null then
    execute format('select count(*) from push_tokens where %I = $1', v_user_col) into v_mine using v_uid;
  end if;
  if v_token_col is not null and p_token is not null then
    execute format('select count(*) from push_tokens where %I = $1', v_token_col) into v_this using p_token;
  end if;
  return jsonb_build_object('table_exists', true, 'columns', to_jsonb(v_cols), 'rows_for_me', v_mine, 'this_phone_saved', v_this > 0);
end;
$$;

grant execute on function register_push_token(text, text) to authenticated;
grant execute on function unregister_push_token(text) to authenticated;
grant execute on function my_push_token_status(text) to authenticated;
