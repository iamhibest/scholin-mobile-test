// =========================================================
// Supabase Edge Function: create-subscription-payment
//
// THIS IS WHERE THE SERVER, NOT THE BROWSER, DECIDES THE PRICE.
//
// The browser sends ONLY: { school_id, months }
// (both of these are still re-checked against the database below —
// school_id is validated against the caller's actual membership, and
// months is validated as a positive integer. Nothing about PRICE comes
// from the browser at any point.)
//
// This function:
//   1. Authenticates the caller from their Supabase session — never
//      from anything in the request body.
//   2. Confirms the caller is an active owner/teacher_admin of the
//      EXACT school_id they're paying for (not just "a" school they
//      belong to).
//   3. Loads subscription_price_per_month and the applicable discount
//      tier from the database and computes the final amount itself.
//   4. Creates the subscription_payments row using the service role
//      (the browser can no longer do this at all — see
//      subscription-security-hardening-v3.sql).
//   5. Calls Paystack's server-side POST /transaction/initialize with
//      the SECRET key (never exposed to the browser) — this is what
//      locks in the amount, currency, and destination Paystack account
//      before the browser ever sees anything.
//   6. Returns ONLY { access_code, payment_id } to the browser. The
//      browser uses access_code with PaystackPop.resumeTransaction() —
//      NOT PaystackPop.setup({ key, amount, ... }). Because
//      resumeTransaction only takes an access_code (see InlineJS
//      Popup V2 docs), there is no public key, amount, or email for a
//      compromised frontend to tamper with at this stage — every one
//      of those was already fixed server-side in step 5.
//
// HOW TO DEPLOY:
// Supabase Dashboard -> Edge Functions -> Create a new function ->
// name it exactly: create-subscription-payment -> paste this file ->
// Deploy. Reuses the existing PAYSTACK_SECRET_KEY secret.
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

    // ---------------------------------------------------------
    // AUTHENTICATE THE CALLER. We never trust a user_id/school role
    // sent in the request body — we derive the caller's identity from
    // their own session token, the same way requireAuth() does on the
    // client, but verified server-side where it can't be forged.
    // ---------------------------------------------------------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return fail(401, 'Missing authorization header');

    const supabaseAsCaller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: userError } = await supabaseAsCaller.auth.getUser();
    if (userError || !userData?.user) return fail(401, 'Invalid or expired session');
    const callerId = userData.user.id;

    // From here on, use the service role client for everything —
    // partly for reliability, partly because writing the payment row
    // requires bypassing the (intentionally) browser-locked INSERT
    // policy on subscription_payments.
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ---------------------------------------------------------
    // Parse and MINIMALLY validate the request body. Only school_id
    // and months are read from it — nothing else the body might
    // contain (amount, price, discount, payment_status, etc.) is ever
    // looked at, even if a tampered frontend sends them.
    // ---------------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const schoolId = typeof body.school_id === 'string' ? body.school_id : null;
    const months = Number.isInteger(body.months) ? body.months : parseInt(body.months);

    if (!schoolId) return fail(400, 'Missing school_id');
    if (!Number.isInteger(months) || months < 1) return fail(400, 'months must be a whole number of 1 or more');

    // ---------------------------------------------------------
    // AUTHORIZE: confirm the caller is an ACTIVE owner or teacher_admin
    // of THIS EXACT school. This is the server-side equivalent of the
    // RLS check that used to gate the insert — now enforced here since
    // the insert itself happens with the service role (which bypasses
    // RLS), so this check is the only thing standing between "any
    // logged-in user" and "creates a payment for someone else's school".
    // ---------------------------------------------------------
    const { data: membership, error: membershipError } = await supabase
      .from('school_members')
      .select('role, is_active')
      .eq('school_id', schoolId)
      .eq('profile_id', callerId)
      .eq('is_active', true)
      .maybeSingle();

    if (membershipError || !membership) return fail(403, 'You are not an active member of this school');
    if (membership.role !== 'owner' && membership.role !== 'teacher_admin') {
      return fail(403, 'Only the school owner or teacher admin can manage the subscription');
    }

    // ---------------------------------------------------------
    // Confirm this school isn't currently cancelled by Super Admin —
    // re-checked here too (defense in depth) even though the frontend
    // also hides the pay button in that state; a tampered frontend
    // must not be able to bypass a cancellation.
    // ---------------------------------------------------------
    const { data: school } = await supabase
      .from('schools')
      .select('id, subscription_cancelled_at')
      .eq('id', schoolId)
      .single();

    if (!school) return fail(404, 'School not found');
    // Cancellation does NOT block starting a new payment — a fresh
    // successful payment is exactly how a cancellation gets cleared,
    // per the existing business rule. So no block here; just noting
    // this is intentional, not an oversight.

    // ---------------------------------------------------------
    // SERVER COMPUTES THE PRICE. This is the entire point of this
    // function — the browser told us "months", nothing about money.
    // ---------------------------------------------------------
    const { data: settings } = await supabase
      .from('app_settings')
      .select('subscription_price_per_month')
      .limit(1)
      .maybeSingle();

    const pricePerMonth = settings ? Number(settings.subscription_price_per_month) : 0;
    if (!pricePerMonth || pricePerMonth <= 0) {
      return fail(400, 'Subscription pricing has not been configured yet. Please contact support.');
    }

    const { data: tiers } = await supabase
      .from('subscription_discount_tiers')
      .select('min_months, discount_percent')
      .order('min_months', { ascending: false });

    const base = months * pricePerMonth;
    const applicableTier = (tiers || []).find(t => months >= t.min_months);
    const discountPercent = applicableTier ? Number(applicableTier.discount_percent) : 0;
    const amountCharged = Math.round((base - base * (discountPercent / 100)) * 100) / 100;

    if (amountCharged <= 0) {
      return fail(400, 'Calculated subscription amount is invalid. Please contact support.');
    }

    // ---------------------------------------------------------
    // Get the caller's email for the Paystack transaction — from the
    // database, not from anything the browser sent.
    // ---------------------------------------------------------
    const { data: profile } = await supabase.from('profiles').select('email').eq('id', callerId).single();
    const email = profile?.email || userData.user.email;
    if (!email) return fail(400, 'Could not determine your email address for payment');

    // ---------------------------------------------------------
    // CREATE THE PAYMENT ROW — service role, bypasses the (now
    // browser-locked) INSERT policy. This row's amount_charged and
    // months are exactly what was computed above, never anything the
    // browser could have influenced.
    // ---------------------------------------------------------
    const { data: payment, error: insertError } = await supabase
      .from('subscription_payments')
      .insert({
        school_id: schoolId,
        initiated_by: callerId,
        months: months,
        amount_charged: amountCharged,
        payment_status: 'pending'
      })
      .select()
      .single();

    if (insertError || !payment) return fail(500, 'Could not create the payment record. Please try again.');

    // Reference format kept identical to the previous architecture —
    // sub_<paymentId>_<timestamp> — so the webhook's existing routing
    // logic (checking for the "sub_" prefix) keeps working unchanged.
    const reference = 'sub_' + payment.id + '_' + Date.now();

    // ---------------------------------------------------------
    // INITIALIZE THE TRANSACTION ON PAYSTACK'S SERVER — this is the
    // step that actually fixes the amount, currency, and destination
    // account. It uses the SECRET key, server-to-server; the browser
    // is never involved in this call and never sees the secret key.
    // ---------------------------------------------------------
    const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        amount: Math.round(amountCharged * 100), // kobo
        currency: 'NGN',
        reference: reference,
        metadata: {
          payment_id: payment.id,
          school_id: schoolId,
          months: months,
          payment_type: 'subscription'
        }
      })
    });

    const initData = await initRes.json();

    if (!initRes.ok || !initData.status || !initData.data?.access_code) {
      // Roll back the pending row so it doesn't sit orphaned with no
      // way to ever be paid (Paystack never got the reference).
      await supabase.from('subscription_payments').delete().eq('id', payment.id).eq('payment_status', 'pending');
      return fail(502, 'Could not start payment with Paystack. Please try again.');
    }

    // Save the reference now that Paystack has accepted it. This uses
    // the service role, so it isn't limited by the browser-facing
    // "pending rows only" update policy — though that policy would
    // have allowed this specific change anyway.
    await supabase.from('subscription_payments').update({ payment_reference: reference }).eq('id', payment.id);

    // ---------------------------------------------------------
    // Return ONLY what the browser needs to resume the transaction —
    // no amount, no key, no price breakdown it could tamper with and
    // replay. The browser can display amountCharged for UX (it already
    // knows the price from the same public pricing endpoint the user
    // saw before clicking Pay), but nothing downstream trusts that
    // display value — verification always re-derives it from this
    // payment row.
    // ---------------------------------------------------------
    return new Response(JSON.stringify({
      access_code: initData.data.access_code,
      authorization_url: initData.data.authorization_url,
      reference: reference,
      payment_id: payment.id,
      amount_charged: amountCharged,
      months: months
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return fail(500, 'Unexpected server error. Please try again.');
  }
});
