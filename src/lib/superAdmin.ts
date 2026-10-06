import { supabase } from './supabase';

async function count(table: string) {
  const { count: c } = await supabase.from(table).select('id', { count: 'exact', head: true });
  return c || 0;
}

export async function fetchPlatformStats() {
  const [schools, teachers, students] = await Promise.all([count('schools'), count('school_members'), count('students')]);
  return { schools, teachers, students };
}

export async function fetchAllSchools() {
  const { data, error } = await supabase.from('schools').select('id, name, address, phone, created_at').order('created_at', { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return (data || []) as any[];
}

export async function fetchSettings() {
  const { data } = await supabase.from('app_settings').select('*').limit(1).maybeSingle();
  return (data || null) as any;
}

export async function saveSettings(patch: Record<string, any>) {
  const { data: existing, error: readError } = await supabase.from('app_settings').select('id').limit(1).maybeSingle();
  if (readError) {
    throw new Error('Could not read the current settings.');
  }
  const { error } = existing
    ? await supabase.from('app_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', existing.id)
    : await supabase.from('app_settings').insert(patch);
  if (error) {
    throw new Error(error.message || 'Could not save.');
  }
}

export async function fetchSchoolFull(id: string) {
  const { data, error } = await supabase.from('schools').select('*').eq('id', id).single();
  if (error || !data) {
    throw new Error('School not found.');
  }
  return data as any;
}

export async function updateSchoolRow(id: string, patch: Record<string, any>) {
  const { error } = await supabase.from('schools').update(patch).eq('id', id);
  if (error) {
    throw new Error(error.message || 'Could not save changes.');
  }
}

export async function fetchSchoolOwner(id: string) {
  const { data } = await supabase.from('school_members').select('*, profiles(full_name, email)').eq('school_id', id).eq('role', 'owner').maybeSingle();
  return (data || null) as any;
}

export async function fetchReferrerName(code: string) {
  const { data } = await supabase.from('profiles').select('full_name').eq('referral_code', code).maybeSingle();
  return data ? (data as any).full_name : null;
}

export async function fetchSchoolCommissions(id: string) {
  const { data } = await supabase.from('referral_commissions').select('commission_amount, status').eq('school_id', id);
  return (data || []) as any[];
}

export async function fetchSchoolPayments(id: string) {
  const { data, error } = await supabase.from('subscription_payments').select('*').eq('school_id', id).order('created_at', { ascending: false }).limit(10);
  if (error) {
    throw new Error('Could not load payment history.');
  }
  return (data || []) as any[];
}

export async function deleteSchoolRow(id: string) {
  const { error } = await supabase.from('schools').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Could not delete school.');
  }
}

export function naira(v: any) {
  return '₦' + Number(v || 0).toLocaleString();
}

export const USERS_PAGE = 30;

export async function fetchUsers(query: string, from: number) {
  let q = supabase.from('profiles').select('*').order('created_at', { ascending: false }).range(from, from + USERS_PAGE - 1);
  const term = query.trim().replace(/[%,()]/g, ' ');
  if (term) {
    q = q.or('full_name.ilike.%' + term + '%,email.ilike.%' + term + '%,phone.ilike.%' + term + '%');
  }
  const { data, error } = await q;
  if (error) {
    throw new Error(error.message);
  }
  return (data || []) as any[];
}

export async function fetchUserDetail(id: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).single();
  if (error || !data) {
    throw new Error('User not found.');
  }
  const { data: memberships } = await supabase.from('school_members').select('id, role, is_active, schools(name)').eq('profile_id', id);
  return { profile: data as any, memberships: (memberships || []) as any[] };
}

export async function manageUser(action: 'block' | 'unblock' | 'delete', userId: string, reason?: string) {
  const { data, error } = await supabase.functions.invoke('manage-user', { body: { action, user_id: userId, reason: reason || null } });
  if (error || !data || data.error) {
    throw new Error((data && data.error) || 'The action failed. Check your connection and try again.');
  }
}

// ---- Subscription pricing, subscriptions and finance ----

export async function fetchTiers() {
  const { data, error } = await supabase.from('subscription_discount_tiers').select('*').order('min_months', { ascending: true });
  if (error) {
    throw new Error('Could not load discount tiers.');
  }
  return (data || []) as any[];
}

export async function addTier(minMonths: number, discount: number) {
  const { error } = await supabase.from('subscription_discount_tiers').insert({ min_months: minMonths, discount_percent: discount });
  if (error) {
    throw new Error(error.message || 'Could not add tier.');
  }
}

export async function deleteTier(id: string) {
  const { error } = await supabase.from('subscription_discount_tiers').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Could not remove tier.');
  }
}

export async function fetchSchoolsForSubscriptions() {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, trial_ends_at, subscription_ends_at, subscription_amount, subscription_months, subscription_cancelled_at, subscription_cancelled_reason, subscribed_at')
    .order('name', { ascending: true });
  if (error) {
    throw new Error('Could not load schools.');
  }
  return (data || []) as any[];
}

export async function fetchFinance() {
  const { data: schools, error: e1 } = await supabase.from('schools').select('id, name, paystack_subaccount_code');
  if (e1) {
    throw new Error('Could not load schools.');
  }
  const { data: payments, error } = await supabase
    .from('event_payments')
    .select('school_id, amount, platform_fee_amount, commission_amount, paystack_fee_amount, net_amount_to_school, settled_at, status')
    .eq('payment_method', 'online')
    .eq('status', 'valid');
  if (error) {
    throw new Error('Could not load payment data.');
  }
  const by: Record<string, any> = {};
  for (const s of (schools || []) as any[]) {
    by[s.id] = { id: s.id, name: s.name, hasSubaccount: !!s.paystack_subaccount_code, collected: 0, commission: 0, paystackFees: 0, net: 0, settled: 0, pending: 0, count: 0 };
  }
  for (const p of (payments || []) as any[]) {
    const row = by[p.school_id];
    if (!row) {
      continue;
    }
    row.collected += Number(p.amount);
    // Older rows only have the combined platform fee, so it is shown as commission rather than dropped.
    row.commission += p.commission_amount !== null ? Number(p.commission_amount) : Number(p.platform_fee_amount || 0);
    row.paystackFees += Number(p.paystack_fee_amount || 0);
    row.net += Number(p.net_amount_to_school || 0);
    row.count++;
    if (p.settled_at) {
      row.settled += Number(p.net_amount_to_school || 0);
    } else {
      row.pending += Number(p.net_amount_to_school || 0);
    }
  }
  const figures = Object.values(by).filter((s: any) => s.count > 0 || s.hasSubaccount) as any[];
  figures.sort((a, b) => b.collected - a.collected);
  return figures;
}

export async function fetchSchoolOnlinePayments(schoolId: string) {
  const { data } = await supabase
    .from('event_payments')
    .select('id, amount, net_amount_to_school, settled_at, payment_date, receipt_number, events(name)')
    .eq('school_id', schoolId)
    .eq('payment_method', 'online')
    .eq('status', 'valid')
    .order('payment_date', { ascending: false })
    .limit(30);
  return (data || []) as any[];
}

export async function syncSettlements() {
  const { data, error } = await supabase.functions.invoke('sync-paystack-settlements', { body: {} });
  if (error || !data || data.error) {
    throw new Error((data && data.error) || 'Could not sync settlements. Please try again.');
  }
  return data as { settlements_synced: number; payments_matched: number };
}

// ---- Referrals, commission tiers and payment terms ----

export async function fetchReferrers() {
  const { data, error } = await supabase
    .from('referral_commissions')
    .select('*, profiles(full_name, email, bank_name, bank_account_number, bank_account_name), schools(name)')
    .order('created_at', { ascending: false });
  if (error) {
    throw new Error('Could not load referral commissions.');
  }
  const by: Record<string, any> = {};
  for (const c of (data || []) as any[]) {
    if (!c.profiles) {
      continue;
    }
    if (!by[c.referrer_id]) {
      by[c.referrer_id] = { id: c.referrer_id, profile: c.profiles, pending: [] as any[], pendingTotal: 0, paidTotal: 0 };
    }
    const g = by[c.referrer_id];
    if (c.status === 'pending') {
      g.pending.push(c);
      g.pendingTotal += Number(c.commission_amount);
    } else if (c.status === 'paid') {
      g.paidTotal += Number(c.commission_amount);
    }
  }
  return Object.values(by) as any[];
}

export async function payOutReferrer(referrerId: string) {
  const { error } = await supabase.rpc('pay_out_referrer', { p_referrer_id: referrerId });
  if (error) {
    throw new Error(error.message || 'Could not process this payout.');
  }
}

export async function fetchReferrerDetail(referrerId: string) {
  const { data: profile } = await supabase.from('profiles').select('full_name, email, referral_code, bank_name, bank_account_number, bank_account_name').eq('id', referrerId).maybeSingle();
  const { data: commissions } = await supabase.from('referral_commissions').select('*, schools(name)').eq('referrer_id', referrerId).order('created_at', { ascending: false });
  const { data: referrals } = await supabase.from('referrals').select('*, schools(name, is_subscribed, subscription_ends_at)').eq('referrer_id', referrerId).order('registered_at', { ascending: false });
  const { data: payouts } = await supabase.from('referral_payouts').select('*').eq('referrer_id', referrerId).order('paid_at', { ascending: false });
  const com = (commissions || []) as any[];
  const bySchool: Record<string, { total: number; pending: number; name: string }> = {};
  for (const c of com) {
    if (!bySchool[c.school_id]) {
      bySchool[c.school_id] = { total: 0, pending: 0, name: c.schools ? c.schools.name : 'School' };
    }
    bySchool[c.school_id].total += Number(c.commission_amount);
    if (c.status === 'pending') {
      bySchool[c.school_id].pending += Number(c.commission_amount);
    }
  }
  return {
    profile: (profile || null) as any,
    pendingTotal: com.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.commission_amount), 0),
    paidTotal: com.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.commission_amount), 0),
    referrals: (referrals || []) as any[],
    bySchool,
    payouts: (payouts || []) as any[],
  };
}

export async function fetchCommissionTiers() {
  const { data, error } = await supabase.from('commission_tiers').select('id, min_amount, max_amount, commission_amount').is('school_id', null).order('min_amount', { ascending: true });
  if (error) {
    throw new Error('Could not load commission ranges. Have you run flat-commission-migration.sql in Supabase? (' + (error.message || '') + ')');
  }
  return (data || []) as any[];
}

export async function addCommissionTier(min: number, max: number | null, fee: number) {
  const { error } = await supabase.from('commission_tiers').insert({ school_id: null, min_amount: min, max_amount: max, commission_amount: fee });
  if (error) {
    throw new Error(error.message || 'Could not add this range.');
  }
}

export async function deleteCommissionTier(id: string) {
  const { error } = await supabase.from('commission_tiers').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Could not remove this range.');
  }
}

// ---- Broadcasts, app version, terms and about, staff attendance ----

export async function fetchBroadcasts() {
  const { data, error } = await supabase.from('announcements').select('*').is('school_id', null).order('created_at', { ascending: false });
  if (error) {
    throw new Error('Could not load broadcasts.');
  }
  return (data || []) as any[];
}

export async function postBroadcast(authorId: string, title: string, body: string) {
  const { error } = await supabase.from('announcements').insert({ author_id: authorId, school_id: null, title, body });
  if (error) {
    throw new Error(error.message || 'Could not post broadcast.');
  }
  // Fire and forget, so a push problem never blocks the broadcast itself.
  supabase.functions.invoke('send-push-notification', { body: { category: 'broadcast', title: 'Scholin Announcement', message: title } }).catch(() => {});
}

export async function updateBroadcast(id: string, title: string, body: string) {
  const { error } = await supabase.from('announcements').update({ title, body }).eq('id', id);
  if (error) {
    throw new Error(error.message || 'Could not save changes.');
  }
}

export async function deleteBroadcast(id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Could not delete this broadcast.');
  }
}

export async function fetchVersionSettings() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('id, app_latest_version, app_update_url, app_update_title, app_update_message, app_update_pushed_at')
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error('Could not load settings. Have you run app-version-update-migration.sql in Supabase? (' + (error.message || '') + ')');
  }
  return (data || null) as any;
}

export async function fetchTermsAndAbout() {
  const { data } = await supabase
    .from('app_settings')
    .select('id, terms_and_conditions, terms_version, terms_updated_at, about_scholin, about_updated_at')
    .limit(1)
    .maybeSingle();
  return (data || null) as any;
}

export async function fetchStaffAttendance(date: string) {
  const { data: members, error } = await supabase
    .from('school_members')
    .select('profile_id, school_id, profiles(id, full_name), schools(id, name)')
    .eq('is_active', true);
  if (error) {
    throw new Error('Could not load staff.');
  }
  const { data: records, error: e2 } = await supabase.from('staff_attendance').select('*').eq('date', date);
  if (e2) {
    throw new Error('Could not load attendance records.');
  }
  const staff = ((members || []) as any[]).filter(m => m.profiles && m.schools);
  return { staff, records: (records || []) as any[] };
}

// ---- Vacancy discount tiers ----

export async function fetchVacancyTiers() {
  const { data, error } = await supabase.from('vacancy_discount_tiers').select('*').order('min_days', { ascending: true });
  if (error) {
    throw new Error('Could not load discount tiers.');
  }
  return (data || []) as any[];
}

export async function addVacancyTier(minDays: number, discount: number) {
  const { error } = await supabase.from('vacancy_discount_tiers').insert({ min_days: minDays, discount_percent: discount });
  if (error) {
    throw new Error(error.message || 'Could not add tier.');
  }
}

export async function deleteVacancyTier(id: string) {
  const { error } = await supabase.from('vacancy_discount_tiers').delete().eq('id', id);
  if (error) {
    throw new Error(error.message || 'Could not remove tier.');
  }
}
