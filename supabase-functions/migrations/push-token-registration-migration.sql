-- =========================================================
-- Scholin: let the app save each phone's notification token.
-- Run once in the Supabase SQL editor.
--
-- The existing send-push-notification function reads the push_tokens table.
-- The mobile app now saves its token there when someone signs in, and removes it on sign out.
-- This works out the column names of your existing push_tokens table by itself
-- (user_id or profile_id, token or fcm_token), so it fits the table your HTML app already uses.
-- =========================================================
create or replace function register_push_token(p_token text, p_platform text default 'android')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_user_col text;
  v_token_col text;
  v_platform_col text;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;
  if p_token is null or length(p_token) < 20 then
    raise exception 'Invalid token';
  end if;

  select column_name into v_user_col from information_schema.columns
    where table_schema = 'public' and table_name = 'push_tokens' and column_name in ('user_id', 'profile_id')
    order by case column_name when 'user_id' then 1 else 2 end limit 1;
  select column_name into v_token_col from information_schema.columns
    where table_schema = 'public' and table_name = 'push_tokens' and column_name in ('token', 'fcm_token', 'device_token')
    order by case column_name when 'token' then 1 when 'fcm_token' then 2 else 3 end limit 1;
  select column_name into v_platform_col from information_schema.columns
    where table_schema = 'public' and table_name = 'push_tokens' and column_name in ('platform', 'device_type', 'device')
    order by case column_name when 'platform' then 1 when 'device_type' then 2 else 3 end limit 1;

  if v_user_col is null or v_token_col is null then
    raise exception 'push_tokens table does not have a user column and a token column';
  end if;

  -- A phone belongs to whoever is signed in on it now.
  execute format('delete from push_tokens where %I = $1', v_token_col) using p_token;

  if v_platform_col is not null then
    execute format('insert into push_tokens (%I, %I, %I) values ($1, $2, $3)', v_user_col, v_token_col, v_platform_col) using v_uid, p_token, p_platform;
  else
    execute format('insert into push_tokens (%I, %I) values ($1, $2)', v_user_col, v_token_col) using v_uid, p_token;
  end if;
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
  v_user_col text;
  v_token_col text;
begin
  if v_uid is null then
    return;
  end if;
  select column_name into v_user_col from information_schema.columns
    where table_schema = 'public' and table_name = 'push_tokens' and column_name in ('user_id', 'profile_id')
    order by case column_name when 'user_id' then 1 else 2 end limit 1;
  select column_name into v_token_col from information_schema.columns
    where table_schema = 'public' and table_name = 'push_tokens' and column_name in ('token', 'fcm_token', 'device_token')
    order by case column_name when 'token' then 1 when 'fcm_token' then 2 else 3 end limit 1;
  if v_user_col is null or v_token_col is null then
    return;
  end if;
  execute format('delete from push_tokens where %I = $1 and %I = $2', v_token_col, v_user_col) using p_token, v_uid;
end;
$$;

grant execute on function register_push_token(text, text) to authenticated;
grant execute on function unregister_push_token(text) to authenticated;
