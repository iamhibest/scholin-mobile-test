-- =========================================================
-- Scholin: Payment history (what Paystack has paid out to a school)
-- Run once in the Supabase SQL editor.
--
-- Returns every online fee payment for a school with:
--   * whether Paystack has paid it out yet (settled_at), and when
--   * the parent who paid and the student it was for
--   * the school's payout account (bank, account name, last 4 digits only)
-- Allowed for: super admins, the school owner, and a teacher admin who has
-- the "Manage events and fees" permission. Nobody else can call it.
-- =========================================================
create or replace function get_school_online_payments(p_school_id uuid, p_limit int default 200)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_allowed boolean := false;
  v_school record;
  v_rows jsonb;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  select coalesce(is_super_admin, false) into v_allowed from profiles where id = v_uid;

  if not coalesce(v_allowed, false) then
    select exists (
      select 1 from school_members m
      where m.school_id = p_school_id
        and m.profile_id = v_uid
        and m.is_active = true
        and (m.role = 'owner' or (m.role = 'teacher_admin' and m.can_manage_events_fees = true))
    ) into v_allowed;
  end if;

  if not coalesce(v_allowed, false) then
    raise exception 'You do not have access to this school''s payment history';
  end if;

  select id, name, paystack_bank_name, paystack_account_name, paystack_account_number
    into v_school from schools where id = p_school_id;

  select coalesce(jsonb_agg(row_to_json(t) order by t.payment_date desc), '[]'::jsonb)
  into v_rows
  from (
    select
      p.id,
      p.receipt_number,
      p.payment_date,
      p.amount,
      p.platform_fee_amount,
      p.net_amount_to_school,
      p.paystack_reference,
      p.settled_at,
      p.paystack_settlement_id,
      e.name as event_name,
      s.full_name as student_name,
      s.admission_no,
      coalesce(pr.full_name, 'Parent') as payer_name
    from event_payments p
    left join events e on e.id = p.event_id
    left join students s on s.id = p.student_id
    left join event_payment_intents i on i.payment_reference = p.paystack_reference
    left join profiles pr on pr.id = i.initiated_by
    where p.school_id = p_school_id
      and p.payment_method = 'online'
      and p.status = 'valid'
    order by p.payment_date desc
    limit greatest(1, least(coalesce(p_limit, 200), 500))
  ) t;

  return jsonb_build_object(
    'school_name', v_school.name,
    'bank_name', v_school.paystack_bank_name,
    'account_name', v_school.paystack_account_name,
    'account_last4', right(coalesce(v_school.paystack_account_number, ''), 4),
    'payments', v_rows
  );
end;
$$;

grant execute on function get_school_online_payments(uuid, int) to authenticated;
