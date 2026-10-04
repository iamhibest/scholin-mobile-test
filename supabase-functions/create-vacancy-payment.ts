// =========================================================
// Supabase Edge Function: create-vacancy-payment
//
// Mirrors create-subscription-payment exactly, for vacancy postings.
// The browser sends ONLY: { title, description, apply_link, days }
// Nothing about price, school_id, or posted_by is trusted from the
// browser — school_id and posted_by are derived from the caller's own
// active school membership, and price is computed server-side from
// vacancy_pricing / vacancy_discount_tiers.
//
// HOW TO DEPLOY:
// Supabase Dashboard -> Edge Functions -> Create a new function ->
// name it exactly: create-vacancy-payment -> paste this file -> Deploy.
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
    // Parse and validate the request body. Only content fields and
    // "days" are read — no price, school_id, posted_by, or
    // payment_status is ever looked at, even if sent.
    // ---------------------------------------------------------
    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    let applyLink = typeof body.apply_link === 'string' ? body.apply_link.trim() : '';
    const days = Number.isInteger(body.days) ? body.days : parseInt(body.days);
    const postingType = body.posting_type === 'personal' ? 'personal' : 'school';

    if (!title || !description) return fail(400, 'Title and description are required');
    if (!Number.isInteger(days) || days < 1) return fail(400, 'days must be a whole number of 1 or more');
    if (applyLink && !/^https?:\/\//i.test(applyLink) && !/^www\./i.test(applyLink)) {
      return fail(400, 'Application link should start with https:// or www.');
    }
    if (applyLink && /^www\./i.test(applyLink)) applyLink = 'https://' + applyLink;

    // ---------------------------------------------------------
    // AUTHORIZE + DERIVE school_id / posted_by from the caller's own
    // active membership — never from the request body. If a school
    // has multiple memberships, we use their currently active school
    // (same logic as getActiveSchoolContext on the client), read
    // authoritatively from profiles.active_school_id.
    // ---------------------------------------------------------
    const { data: profile } = await supabase.from('profiles').select('active_school_id, email').eq('id', callerId).single();
    if (!profile?.active_school_id) return fail(400, 'No active school found for your account');

    const { data: membership, error: membershipError } = await supabase
      .from('school_members')
      .select('role, is_active, school_id')
      .eq('school_id', profile.active_school_id)
      .eq('profile_id', callerId)
      .eq('is_active', true)
      .maybeSingle();

    if (membershipError || !membership) return fail(403, 'You are not an active member of this school');

    const schoolId = membership.school_id;
    const email = profile.email || userData.user.email;
    if (!email) return fail(400, 'Could not determine your email address for payment');

    // ---------------------------------------------------------
    // SERVER COMPUTES THE PRICE.
    // ---------------------------------------------------------
    const { data: pricing } = await supabase.from('vacancy_pricing').select('price_per_day').limit(1).maybeSingle();
    const pricePerDay = pricing ? Number(pricing.price_per_day) : 0;

    const { data: tiers } = await supabase
      .from('vacancy_discount_tiers')
      .select('min_days, discount_percent')
      .order('min_days', { ascending: false });

    const base = days * pricePerDay;
    const applicableTier = (tiers || []).find(t => days >= t.min_days);
    const discountPercent = applicableTier ? Number(applicableTier.discount_percent) : 0;
    const amountCharged = Math.round((base - base * (discountPercent / 100)) * 100) / 100;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    // ---------------------------------------------------------
    // CREATE THE VACANCY ROW — service role, bypasses the (now
    // browser-locked) INSERT policy. Free postings (amountCharged <= 0,
    // if pricing is configured that way) go straight to 'free' and
    // skip Paystack entirely, same behavior as before.
    // ---------------------------------------------------------
    const { data: vacancy, error: insertError } = await supabase
      .from('vacancies')
      .insert({
        school_id: schoolId,
        posted_by: callerId,
        posting_type: postingType,
        title, description,
        apply_link: applyLink || null,
        days_purchased: days,
        amount_charged: amountCharged,
        payment_status: amountCharged > 0 ? 'pending' : 'free',
        is_active: true,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (insertError || !vacancy) return fail(500, 'Could not create the vacancy posting. Please try again.');

    if (amountCharged <= 0) {
      // Free posting — nothing to pay, nothing to initialize with Paystack.
      return new Response(JSON.stringify({ free: true, vacancy_id: vacancy.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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
          school_id: schoolId,
          payment_type: 'vacancy'
        }
      })
    });

    const initData = await initRes.json();

    if (!initRes.ok || !initData.status || !initData.data?.access_code) {
      // Roll back — delete the pending vacancy so it doesn't sit
      // unpayable with no reference Paystack ever accepted.
      await supabase.from('vacancies').delete().eq('id', vacancy.id).eq('payment_status', 'pending');
      return fail(502, 'Could not start payment with Paystack. Please try again.');
    }

    await supabase.from('vacancies').update({ payment_reference: reference }).eq('id', vacancy.id);

    return new Response(JSON.stringify({
      access_code: initData.data.access_code,
      authorization_url: initData.data.authorization_url,
      reference: reference,
      vacancy_id: vacancy.id,
      amount_charged: amountCharged,
      days: days
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    return fail(500, 'Unexpected server error. Please try again.');
  }
});
