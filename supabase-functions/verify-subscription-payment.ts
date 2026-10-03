// =========================================================
// Supabase Edge Function: verify-subscription-payment
//
// HOW TO DEPLOY:
// Supabase Dashboard -> Edge Functions -> create/replace function
// named exactly: verify-subscription-payment -> paste this file ->
// Deploy. Reuses the existing PAYSTACK_SECRET_KEY secret.
//
// WHAT IT DOES AND WHY EACH CHECK EXISTS:
// The app calls this after the Paystack popup reports success. This
// function NEVER trusts that report — it independently asks Paystack's
// own server "did this reference really get paid, for how much, in
// what currency, and for which Scholin payment record?" and only marks
// the row paid if every check passes. Every check below maps to one of
// the non-negotiable payment security rules:
//
//   - Caller authentication + ownership check   -> rules 1, 4
//   - Independent Paystack verification          -> rules 3, 27
//   - metadata.payment_id / payment_type match    -> rules 8, 9
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

    // ---------------------------------------------------------
    // Authenticate the caller (rule 1: never trust the frontend for
    // identity) and use the service role only for the actual writes.
    // ---------------------------------------------------------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return fail(401, 'Missing authorization header');

    const supabaseAsCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: userData, error: userError } = await supabaseAsCaller.auth.getUser();
    if (userError || !userData?.user) return fail(401, 'Invalid or expired session');
    const callerId = userData.user.id;

    const { reference, payment_id } = await req.json();
    if (!reference || !payment_id) return fail(400, 'Missing reference or payment_id');

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Load the payment row first — we need its school_id to check the
    // caller actually belongs there, and its amount/months to compare
    // against what Paystack reports.
    const { data: payment, error: fetchError } = await supabase
      .from('subscription_payments')
      .select('id, school_id, amount_charged, payment_status, payment_reference')
      .eq('id', payment_id)
      .maybeSingle();

    if (fetchError || !payment) return fail(404, 'Subscription payment record not found');

    // Caller must be an active member of the school this payment
    // belongs to — otherwise anyone with a payment_id (not secret, just
    // a UUID) could probe for its existence/amount/status.
    const { data: membership } = await supabase
      .from('school_members')
      .select('id')
      .eq('school_id', payment.school_id)
      .eq('profile_id', callerId)
      .eq('is_active', true)
      .maybeSingle();

    if (!membership) return fail(403, 'You do not have access to this payment record');

    if (payment.payment_status === 'paid') {
      return new Response(JSON.stringify({ success: true, already_paid: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ---------------------------------------------------------
    // Independently verify with Paystack — never trust the browser's
    // "success" claim (rule 27).
    // ---------------------------------------------------------
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

    // ---------------------------------------------------------
    // metadata.payment_id must match the EXACT row being verified —
    // this is what prevents a genuinely-successful reference from a
    // DIFFERENT payment (even for the same amount) from being replayed
    // here (rules 8, 10).
    // ---------------------------------------------------------
    const metadataPaymentId = verifyData.data.metadata?.payment_id;
    if (!metadataPaymentId || metadataPaymentId !== payment_id) {
      return fail(400, 'This payment reference does not belong to this subscription payment.');
    }

    // metadata.payment_type must say "subscription" — prevents a
    // vacancy payment's reference from ever being accepted here, even
    // if someone manually typed a real vacancy reference into the
    // subscription "check reference" box (rule 9).
    const metadataPaymentType = verifyData.data.metadata?.payment_type;
    if (metadataPaymentType !== 'subscription') {
      return fail(400, 'This payment reference is not a subscription payment.');
    }

    // Currency check (rule 7) — Scholin only charges NGN; reject
    // anything else outright rather than assume it's fine.
    if (verifyData.data.currency !== 'NGN') {
      return fail(400, `Unexpected currency (${verifyData.data.currency}) — payment not accepted.`);
    }

    // Belt-and-braces reference-reuse check (rule 10) — a reference
    // already marking a DIFFERENT row paid can never be reused here,
    // independent of the atomic update below (which would also catch
    // this via the unique constraint, but we check explicitly first
    // for a clearer error message).
    const { data: alreadyUsedElsewhere } = await supabase
      .from('subscription_payments')
      .select('id')
      .eq('payment_reference', reference)
      .eq('payment_status', 'paid')
      .neq('id', payment_id)
      .maybeSingle();

    if (alreadyUsedElsewhere) {
      return fail(400, 'This payment reference has already been used for a different subscription payment.');
    }

    // Amount check (rule 5) — the amount actually charged by Paystack
    // must match what the SERVER decided at creation time
    // (create-subscription-payment), never anything from the browser.
    const amountPaidNaira = verifyData.data.amount / 100;
    if (Math.round(amountPaidNaira) !== Math.round(payment.amount_charged)) {
      return fail(400, `Amount paid (N${amountPaidNaira.toLocaleString()}) does not match the price of this subscription (N${Number(payment.amount_charged).toLocaleString()}).`);
    }

    // ---------------------------------------------------------
    // ATOMIC, IDEMPOTENT APPLY (rules 12, 13). This single conditional
    // UPDATE is the only place payment_status ever becomes 'paid'. If
    // the webhook already applied this exact payment a moment earlier
    // (race condition), this returns NULL and we treat that as success
    // without re-applying anything.
    // ---------------------------------------------------------
    const { data: applyResult, error: applyError } = await supabase
      .rpc('mark_subscription_payment_paid', { p_payment_id: payment_id, p_reference: reference });

    if (applyError) return fail(500, 'Could not save this subscription as paid. Please try again or contact support.');

    // applyResult is null if another process (the webhook) already won
    // the race and marked it paid first — that's success, not failure.
    return new Response(JSON.stringify({ success: true, already_paid: !applyResult }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    // FAIL CLOSED (rule 25): any unexpected error means we do NOT mark
    // the payment paid. We also never include err details that could
    // leak secrets — just a generic message.
    return fail(500, 'Unexpected error. Please try again.');
  }
});
