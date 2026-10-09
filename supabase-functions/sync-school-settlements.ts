// =========================================================
// Supabase Edge Function: sync-school-settlements   (OPTIONAL)
//
// Lets a school owner / authorised teacher admin tap "Check Paystack" on the
// Payment History screen to see whether Paystack has paid their payments out.
// It only ever looks at ONE school (the caller's own) and only sets
// settled_at on that school's own event_payments. It never moves money.
//
// Your existing sync-paystack-settlements function (super admin) is untouched.
// Without this function the Payment History screen still works; payments just
// turn to "Paid" when the super admin presses Sync settlements.
//
// HOW TO DEPLOY: Supabase Dashboard -> Edge Functions -> new function named
// exactly: sync-school-settlements -> paste this file -> Deploy.
// Uses the existing PAYSTACK_SECRET_KEY secret.
// =========================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!secret || !url || !serviceKey) return json(500, { error: 'Server is not fully set up.' });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Missing authorization header' });
    const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await asCaller.auth.getUser();
    if (!userData?.user) return json(401, { error: 'Invalid or expired session' });
    const uid = userData.user.id;

    const db = createClient(url, serviceKey);
    const body = await req.json().catch(() => ({}));
    const schoolId = typeof body.school_id === 'string' ? body.school_id : '';
    if (!schoolId) return json(400, { error: 'school_id is required' });

    // Same access rule as the Payment History screen.
    const { data: prof } = await db.from('profiles').select('is_super_admin').eq('id', uid).maybeSingle();
    let allowed = !!prof?.is_super_admin;
    if (!allowed) {
      const { data: m } = await db.from('school_members').select('role, can_manage_events_fees')
        .eq('school_id', schoolId).eq('profile_id', uid).eq('is_active', true).maybeSingle();
      allowed = !!m && (m.role === 'owner' || (m.role === 'teacher_admin' && m.can_manage_events_fees === true));
    }
    if (!allowed) return json(403, { error: 'You do not have access to this school.' });

    const { data: school } = await db.from('schools').select('paystack_subaccount_code').eq('id', schoolId).maybeSingle();
    if (!school?.paystack_subaccount_code) return json(400, { error: 'This school has no payout account yet.' });


    const ps = (path) => fetch('https://api.paystack.co' + path, { headers: { Authorization: 'Bearer ' + secret } }).then(r => r.json());

    // Same call as sync-paystack-settlements, for this one school only.
    const list = await ps('/settlement?subaccount=' + encodeURIComponent(school.paystack_subaccount_code) + '&status=success&perPage=50');
    if (!list?.status) return json(502, { error: 'Could not reach Paystack. Please try again.' });

    let settlements = 0;
    let matched = 0;
    for (const st of list.data || []) {
      settlements++;
      // Recorded the same way the super admin sync records it.
      await db.from('paystack_settlements').upsert({
        id: st.id, school_id: schoolId, subaccount_code: school.paystack_subaccount_code,
        status: st.status, total_amount: st.total_amount, total_fees: st.total_fees, settlement_date: st.settlement_date,
      });
      // Every settlement is always checked (not skipped once seen), and every page of its transactions is read,
      // so a payment missed once is picked up the next time. Already-settled payments are never touched again.
      let page = 1;
      while (page <= 20) {
        const tx = await ps('/settlement/' + st.id + '/transactions?perPage=100&page=' + page);
        if (!tx?.status) break;
        const rows = tx.data || [];
        const refs = rows.map(r => r.reference).filter(r => r && String(r).startsWith('fee_'));
        if (refs.length) {
          const { data: updated } = await db.from('event_payments')
            .update({ settled_at: st.settlement_date, paystack_settlement_id: st.id })
            .eq('school_id', schoolId).in('paystack_reference', refs).is('settled_at', null).select('id');
          matched += (updated || []).length;
        }
        if (rows.length < 100) break;
        page++;
      }
    }
    return json(200, { settlements_synced: settlements, payments_matched: matched });
  } catch (err) {
    console.error('sync-school-settlements error:', err?.message || err);
    return json(500, { error: 'Unexpected server error. Please try again.' });
  }
});
