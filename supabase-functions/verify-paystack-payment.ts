// =========================================================
// Supabase Edge Function: verify-paystack-payment (vacancies)
//
// Kept under its original function name so you don't need to
// re-point anything that already calls it — only the code inside
// changed. Deploy by replacing the existing function's code.
//
// Mirrors verify-subscription-payment.ts exactly. Every check maps to
// one of the non-negotiable payment security rules:
//   - Caller authentication + ownership check   -> rules 1, 4
//   - Independent Paystack verification          -> rules 3, 27
//   - metadata.vacancy_id / payment_type match    -> rules 8, 9
//   - amount + currency match                     -> rules 5, 7
//   - reference-reuse / cross-payment-type check  -> rules 8, 10
//   - atomic conditional UPDATE (not read-then-write) -> rules 12, 13
//   - fail closed on any mismatch                 -> rule 25
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecret) return fail(500, 'Server is missing PAYSTACK_SECRET_KEY');
    if (!supabaseUrl || !serviceRoleKey) return fail(500, 'Server is missing Supabase service credentials');

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return fail(401, 'Missing authorization header');

    const supabaseAsCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await supabaseAsCaller.auth.getUser();
    if (userError || !userData?.user) return fail(401, 'Invalid or expired session');
    const callerId = userData.user.id;

    const { reference, vacancy_id } = await req.json();
    if (!reference || !vacancy_id) return fail(400, 'Missing reference or vacancy_id');

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: vacancy, error: fetchError } = await supabase
      .from('vacancies')
      .select('id, school_id, posted_by, amount_charged, payment_status')
      .eq('id', vacancy_id)
      .maybeSingle();

    if (fetchError || !vacancy) return fail(404, 'Vacancy not found');

    // Caller must either be the poster, or an active member of the
    // school that owns this vacancy — not an unrelated authenticated user.
    const isPoster = vacancy.posted_by === callerId;
    let hasSchoolAccess = isPoster;
    if (!hasSchoolAccess) {
      const { data: membership } = await supabase
        .from('school_members')
        .select('id')
        .eq('school_id', vacancy.school_id)
        .eq('profile_id', callerId)
        .eq('is_active', true)
        .maybeSingle();
      hasSchoolAccess = !!membership;
    }
    if (!hasSchoolAccess) return fail(403, 'You do not have access to this posting');

    if (vacancy.payment_status === 'paid') {
      return new Response(JSON.stringify({ success: true, already_paid: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Independent Paystack verification (rule 27) — never trust the
    // browser's own "success" claim.
    const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${paystackSecret}` }
    });
    const verifyData = await verifyRes.json();

    if (!verifyRes.ok || !verifyData.status || verifyData.data?.status !== 'success') {
      const payStatus = verifyData.data?.status || 'unknown';
      const friendlyMessages = {
        abandoned: 'Payment was not completed — no charge went through.',
        failed: 'Payment failed — no charge went through.',
        pending: 'Payment is still processing. Please wait a moment and try again.',
        reversed: 'Payment was reversed.'
      };
      return fail(400, friendlyMessages[payStatus] || 'Payment could not be confirmed for this reference.');
    }

    // metadata.vacancy_id must match this EXACT row (rules 8, 10) —
    // prevents replaying a reference from a different vacancy, even
    // for the same amount.
    const metadataVacancyId = verifyData.data.metadata?.vacancy_id;
    if (!metadataVacancyId || metadataVacancyId !== vacancy_id) {
      return fail(400, 'This payment reference does not belong to this posting.');
    }

    // metadata.payment_type must say "vacancy" (rule 9) — prevents a
    // subscription payment's reference from ever being accepted here.
    const metadataPaymentType = verifyData.data.metadata?.payment_type;
    if (metadataPaymentType !== 'vacancy') {
      return fail(400, 'This payment reference is not a vacancy payment.');
    }

    if (verifyData.data.currency !== 'NGN') {
      return fail(400, `Unexpected currency (${verifyData.data.currency}) — payment not accepted.`);
    }

    const { data: alreadyUsedElsewhere } = await supabase
      .from('vacancies')
      .select('id')
      .eq('payment_reference', reference)
      .eq('payment_status', 'paid')
      .neq('id', vacancy_id)
      .maybeSingle();

    if (alreadyUsedElsewhere) {
      return fail(400, 'This payment reference has already been used for a different posting.');
    }

    const amountPaidNaira = verifyData.data.amount / 100;
    if (Math.round(amountPaidNaira) !== Math.round(vacancy.amount_charged)) {
      return fail(400, `Amount paid (N${amountPaidNaira.toLocaleString()}) does not match the price of this posting (N${Number(vacancy.amount_charged).toLocaleString()}).`);
    }

    // Atomic, idempotent apply (rules 12, 13) — the only place
    // payment_status ever becomes 'paid'. If the webhook already
    // applied this exact payment moments earlier, this returns NULL
    // and we treat that as success without reapplying anything.
    const { data: applyResult, error: applyError } = await supabase
      .rpc('mark_vacancy_payment_paid', { p_vacancy_id: vacancy_id, p_reference: reference });

    if (applyError) return fail(500, 'Could not save this posting as paid. Please try again or contact support.');

    return new Response(JSON.stringify({ success: true, already_paid: !applyResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    // Fail closed (rule 25) — never mark paid on an unexpected error,
    // and never leak error internals that could reveal secrets.
    return fail(500, 'Unexpected error. Please try again.');
  }
});
