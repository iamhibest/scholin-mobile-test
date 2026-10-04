// =========================================================
// Supabase Edge Function: reinitialize-vacancy-payment
//
// Used by the "Pay Now" retry button on an EXISTING pending vacancy.
// Paystack access codes are single-use, so a fresh popup requires a
// fresh /transaction/initialize call — but the amount charged is
// re-read from the vacancy row itself (set by create-vacancy-payment
// at creation time), never recalculated from anything the browser
// sends. The browser only ever sends { vacancy_id }.
//
// HOW TO DEPLOY:
// Supabase Dashboard -> Edge Functions -> Create a new function ->
// name it exactly: reinitialize-vacancy-payment -> paste this file ->
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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
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

    const body = await req.json().catch(() => ({}));
    const vacancyId = typeof body.vacancy_id === 'string' ? body.vacancy_id : null;
    if (!vacancyId) return fail(400, 'Missing vacancy_id');

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: vacancy, error: fetchError } = await supabase
      .from('vacancies')
      .select('id, school_id, posted_by, amount_charged, payment_status')
      .eq('id', vacancyId)
      .maybeSingle();

    if (fetchError || !vacancy) return fail(404, 'Vacancy not found');

    // Caller must be the poster or an active member of the owning school.
    const isPoster = vacancy.posted_by === callerId;
    let hasAccess = isPoster;
    if (!hasAccess) {
      const { data: membership } = await supabase
        .from('school_members')
        .select('id')
        .eq('school_id', vacancy.school_id)
        .eq('profile_id', callerId)
        .eq('is_active', true)
        .maybeSingle();
      hasAccess = !!membership;
    }
    if (!hasAccess) return fail(403, 'You do not have access to this posting');

    if (vacancy.payment_status === 'paid') {
      return new Response(JSON.stringify({ already_paid: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (vacancy.payment_status !== 'pending') {
      return fail(400, 'This posting is not awaiting payment.');
    }

    const { data: profile } = await supabase.from('profiles').select('email').eq('id', callerId).single();
    const email = profile?.email || userData.user.email;
    if (!email) return fail(400, 'Could not determine your email address for payment');

    // The amount is read from the row created earlier by
    // create-vacancy-payment — NEVER recalculated from anything the
    // browser sends here.
    const amountCharged = Number(vacancy.amount_charged);
    if (!amountCharged || amountCharged <= 0) return fail(400, 'This posting has no valid amount to charge.');

    const reference = 'vac_' + vacancy.id + '_' + Date.now();

    const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        amount: Math.round(amountCharged * 100),
        currency: 'NGN',
        reference: reference,
        metadata: {
          vacancy_id: vacancy.id,
          school_id: vacancy.school_id,
          payment_type: 'vacancy'
        }
      })
    });

    const initData = await initRes.json();
    if (!initRes.ok || !initData.status || !initData.data?.access_code) {
      return fail(502, 'Could not restart payment with Paystack. Please try again.');
    }

    await supabase.from('vacancies').update({ payment_reference: reference }).eq('id', vacancy.id);

    return new Response(JSON.stringify({ access_code: initData.data.access_code, authorization_url: initData.data.authorization_url, reference: reference }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return fail(500, 'Unexpected server error. Please try again.');
  }
});
