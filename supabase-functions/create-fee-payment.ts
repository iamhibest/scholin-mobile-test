// =========================================================
// Supabase Edge Function: create-fee-payment
//
// Stage B2 of online fee payments. Mirrors create-vacancy-payment.ts
// and create-subscription-payment.ts exactly in shape and security
// posture. The browser sends ONLY: { event_id, student_id, amount? }
//
// "amount" is the one field this flow lets the browser suggest — a
// parent may pay in full or in part, same as an admin typing a
// partial amount into the manual payment form. Everything else is
// derived or capped server-side and never trusted from the browser:
//   - which student/event this is for -> verified against the
//     caller's own parent_student_links row, not just accepted
//   - amount_due                       -> event_students, not events.amount
//   - remaining balance                -> amount_due minus the sum of
//                                          existing valid event_payments
//   - amount actually charged          -> clamped to that balance
//   - platform commission              -> commission_tiers / school
//                                          override / default, same
//                                          "highest qualifying tier"
//                                          logic as vacancy discounts
//   - destination account              -> school's own
//                                          paystack_subaccount_code
//
// A pending row is created in event_payment_intents BEFORE Paystack is
// ever told about the attempt — same pattern as vacancies/subscriptions,
// so B3 (verify-fee-payment + webhook) always has a row to apply to.
//
// HOW TO DEPLOY:
// Supabase Dashboard -> Edge Functions -> Create a new function ->
// name it exactly: create-fee-payment -> paste this file -> Deploy.
// Reuses the existing PAYSTACK_SECRET_KEY secret.
// =========================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const fail = (status, error) =>
    new Response(JSON.stringify({ error }), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecret) return fail(500, 'Server is missing PAYSTACK_SECRET_KEY');

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return fail(500, 'Server is missing Supabase service credentials');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return fail(401, 'Missing authorization header');

    const supabaseAsCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: userError } = await supabaseAsCaller.auth.getUser();
    if (userError || !userData?.user) return fail(401, 'Invalid or expired session');
    const callerId = userData.user.id;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ---------------------------------------------------------
    // Parse request. Only event_id, student_id, and an optional amount
    // are ever read — no school_id, commission, or payment_status is
    // looked at, even if sent.
    // ---------------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const eventId = typeof body.event_id === 'string' ? body.event_id : '';
    const studentId = typeof body.student_id === 'string' ? body.student_id : '';
    const requestedAmount = body.amount !== undefined && body.amount !== null ? Number(body.amount) : null;

    if (!eventId || !studentId) return fail(400, 'event_id and student_id are required');
    if (requestedAmount !== null && (!Number.isFinite(requestedAmount) || requestedAmount <= 0)) {
      return fail(400, 'amount must be a positive number');
    }

    // ---------------------------------------------------------
    // AUTHORIZE: caller must be a parent actually linked to this exact
    // student — never assumed from the request body.
    // ---------------------------------------------------------
    const { data: link, error: linkError } = await supabase
      .from('parent_student_links')
      .select('id')
      .eq('parent_id', callerId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (linkError || !link) return fail(403, 'You are not linked to this student');

    const { data: profile } = await supabase.from('profiles').select('email').eq('id', callerId).single();
    const email = profile?.email || userData.user.email;
    if (!email) return fail(400, 'Could not determine your email address for payment');

    // ---------------------------------------------------------
    // Load the event and its fee for this student. amount_due comes
    // from event_students (possible per-student override), never the
    // raw events.amount.
    // ---------------------------------------------------------
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, school_id, name, deleted_at')
      .eq('id', eventId)
      .maybeSingle();

    if (eventError || !event || event.deleted_at) return fail(404, 'This fee could not be found');

    const { data: eventStudent, error: esError } = await supabase
      .from('event_students')
      .select('amount_due')
      .eq('event_id', eventId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (esError || !eventStudent) return fail(404, 'This fee does not apply to this student');

    const { data: existingPayments } = await supabase
      .from('event_payments')
      .select('amount')
      .eq('event_id', eventId)
      .eq('student_id', studentId)
      .eq('status', 'valid');

    const alreadyPaid = (existingPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const balance = Math.round((Number(eventStudent.amount_due) - alreadyPaid) * 100) / 100;

    if (balance <= 0) return fail(400, 'This fee is already fully paid');

    // The browser may suggest a partial amount, but it is always
    // capped to the real remaining balance — never trusted past it.
    const amount = requestedAmount !== null ? Math.min(requestedAmount, balance) : balance;
    const roundedAmount = Math.round(amount * 100) / 100;

    // ---------------------------------------------------------
    // The school must have a working payout account before it can
    // accept an online payment at all.
    // ---------------------------------------------------------
    const { data: school } = await supabase
      .from('schools')
      .select('id, paystack_subaccount_code')
      .eq('id', event.school_id)
      .maybeSingle();

    if (!school?.paystack_subaccount_code) {
      return fail(400, 'This school has not set up online payments yet. Please pay by cash or bank transfer instead.');
    }

    // ---------------------------------------------------------
    // SERVER COMPUTES THE COMMISSION — a FLAT NAIRA AMOUNT looked up by
    // which range this payment amount falls in (see the super admin's
    // Commission Tiers page: Min, Max, and a "this amount and above"
    // range). This is a fixed ₦ figure, never a percentage.
    //
    // get_flat_commission is one function in the database (see
    // flat-commission-migration.sql) so every caller uses exactly the
    // same ranges, decided the same way. If no range matches — no
    // ranges have been set up yet, or a gap was left between two
    // ranges — the payment is refused rather than guessing a fee,
    // since guessing could overcharge or undercharge a parent.
    // ---------------------------------------------------------
    const { data: commissionAmount, error: commissionError } = await supabase
      .rpc('get_flat_commission', { p_amount: roundedAmount });

    if (commissionError || commissionAmount === null || commissionAmount === undefined) {
      console.error('create-fee-payment: no commission range matches', roundedAmount, commissionError?.message);
      return fail(400, 'Online payments are not fully set up yet for this amount. Please pay by cash or bank transfer instead.');
    }

    // ---------------------------------------------------------
    // CREATE THE PENDING INTENT — service role, before Paystack ever
    // hears about this attempt. id is generated here (rather than
    // after insert) because payment_reference embeds it and is
    // NOT NULL on this table.
    // ---------------------------------------------------------
    const intentId = crypto.randomUUID();
    const reference = 'fee_' + intentId + '_' + Date.now();

    const { error: insertError } = await supabase
      .from('event_payment_intents')
      .insert({
        id: intentId,
        event_id: eventId,
        student_id: studentId,
        initiated_by: callerId,
        amount: roundedAmount,
        commission_amount: commissionAmount,
        payment_reference: reference,
        payment_status: 'pending'
      });

    if (insertError) {
      console.error('create-fee-payment insertError:', insertError.message, insertError.details, insertError.hint);
      return fail(500, 'Could not start this payment. Please try again.');
    }

    const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        amount: Math.round(roundedAmount * 100),
        currency: 'NGN',
        reference: reference,
        subaccount: school.paystack_subaccount_code,
        transaction_charge: Math.round(commissionAmount * 100),
        metadata: {
          intent_id: intentId,
          event_id: eventId,
          student_id: studentId,
          payment_type: 'event_fee'
        }
      })
    });

    const initData = await initRes.json();

    if (!initRes.ok || !initData.status || !initData.data?.access_code) {
      // Roll back — delete the pending intent so it doesn't sit
      // unpayable with no reference Paystack ever accepted.
      await supabase.from('event_payment_intents').delete().eq('id', intentId).eq('payment_status', 'pending');
      return fail(502, 'Could not start payment with Paystack. Please try again.');
    }

    return new Response(JSON.stringify({
      access_code: initData.data.access_code,
      authorization_url: initData.data.authorization_url,
      reference: reference,
      intent_id: intentId,
      amount_charged: roundedAmount,
      balance_before: balance,
      event_name: event.name
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('create-fee-payment error:', err?.message || err, err?.stack || '');
    return fail(500, 'Unexpected server error. Please try again.');
  }
});
