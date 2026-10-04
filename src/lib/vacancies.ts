import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { callFunction, Checkout } from './payments';

function fail(error: any, fallback: string): never {
  throw new Error((error && error.message) || fallback);
}

const DAY = 86400000;

export type Vacancy = {
  id: string;
  title: string;
  description: string;
  apply_link: string | null;
  created_at: string;
  expires_at: string;
  days_purchased: number;
  amount_charged: number;
  payment_status: string;
  payment_reference?: string | null;
  posted_by?: string;
  school_id?: string;
  schools?: { name?: string; logo_url?: string | null; address?: string | null; phone?: string | null; email?: string | null } | null;
};

export async function fetchOpenVacancies() {
  const { data, error } = await supabase
    .from('vacancies')
    .select('*, schools(name, logo_url)')
    .eq('is_active', true)
    .in('payment_status', ['paid', 'free'])
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) {
    fail(error, 'Could not load vacancies.');
  }
  return (data || []) as Vacancy[];
}

export async function fetchVacancy(id: string) {
  const { data, error } = await supabase.from('vacancies').select('*, schools(name, address, phone, email, logo_url)').eq('id', id).single();
  if (error || !data) {
    return null;
  }
  return data as Vacancy;
}

export async function canSeePostingDetail(vacancy: Vacancy, userId: string) {
  if (vacancy.posted_by === userId) {
    return true;
  }
  const { data } = await supabase.from('school_members').select('id').eq('school_id', vacancy.school_id).eq('profile_id', userId).eq('is_active', true).maybeSingle();
  return !!data;
}

export async function fetchMyVacancies(userId: string) {
  const { data, error } = await supabase.from('vacancies').select('*').eq('posted_by', userId).order('created_at', { ascending: false });
  if (error) {
    fail(error, 'Could not load your postings.');
  }
  return (data || []) as Vacancy[];
}

export async function fetchVacancyFlags() {
  const { data } = await supabase.from('app_settings').select('vacancy_page_enabled, vacancy_posting_enabled').limit(1).maybeSingle();
  return {
    pageEnabled: data ? data.vacancy_page_enabled !== false : true,
    postingEnabled: data ? data.vacancy_posting_enabled !== false : true,
  };
}

export async function fetchVacancyPricing() {
  const [pricing, tiers] = await Promise.all([
    supabase.from('vacancy_pricing').select('*').limit(1).maybeSingle(),
    supabase.from('vacancy_discount_tiers').select('*').order('min_days', { ascending: false }),
  ]);
  return {
    pricePerDay: pricing.data ? Number(pricing.data.price_per_day) : 0,
    tiers: ((tiers.data || []) as any[]).map(t => ({ min_days: Number(t.min_days), discount_percent: Number(t.discount_percent) })),
  };
}

// Preview only. The server works out the real amount again before anything is charged.
export function vacancyPrice(days: number, pricePerDay: number, tiers: { min_days: number; discount_percent: number }[]) {
  const base = days * pricePerDay;
  const tier = tiers.find(t => days >= t.min_days);
  const percent = tier ? tier.discount_percent : 0;
  const discount = base * (percent / 100);
  return { base, percent, discount, total: base - discount };
}

export type PostResult = { free: true } | { free: false; checkout: Checkout };

export async function postVacancy(form: { title: string; description: string; applyLink: string; days: number }): Promise<PostResult> {
  const r = await callFunction(
    'create-vacancy-payment',
    { title: form.title, description: form.description, apply_link: form.applyLink || null, days: form.days },
    'Could not start your posting. Please try again.',
  );
  if (r.free) {
    return { free: true };
  }
  if (!r.authorization_url) {
    throw new Error('Payment could not be started. Please try again.');
  }
  return { free: false, checkout: { url: r.authorization_url, reference: r.reference, paymentId: r.vacancy_id, amount: Number(r.amount_charged) } };
}

export async function restartVacancyPayment(vacancyId: string): Promise<Checkout | null> {
  const r = await callFunction('reinitialize-vacancy-payment', { vacancy_id: vacancyId }, 'Could not restart this payment. Please try again.');
  if (r.already_paid) {
    return null;
  }
  if (!r.authorization_url) {
    throw new Error('Payment could not be restarted. Please try again.');
  }
  return { url: r.authorization_url, reference: r.reference, paymentId: vacancyId };
}

export async function updateVacancy(id: string, patch: { title: string; description: string; applyLink: string }) {
  const { error } = await supabase.from('vacancies').update({ title: patch.title, description: patch.description, apply_link: patch.applyLink || null }).eq('id', id);
  if (error) {
    fail(error, 'Could not save changes.');
  }
}

export async function deleteVacancy(id: string) {
  const { error } = await supabase.from('vacancies').delete().eq('id', id);
  if (error) {
    fail(error, 'Could not delete posting.');
  }
}

export function normalizeLink(raw: string) {
  const link = raw.trim();
  if (!link) {
    return '';
  }
  if (/^https?:\/\//i.test(link)) {
    return link;
  }
  if (/^www\./i.test(link)) {
    return 'https://' + link;
  }
  return 'invalid';
}

/* Small helpers for cards */

export function daysLeft(v: { expires_at: string }) {
  return Math.max(0, Math.ceil((new Date(v.expires_at).getTime() - Date.now()) / DAY));
}

export function isNew(v: { created_at: string }) {
  return Date.now() - new Date(v.created_at).getTime() < 3 * DAY;
}

export function closingSoon(v: { expires_at: string }) {
  return daysLeft(v) <= 3;
}

export function postedAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {
    return 'Just now';
  }
  if (mins < 60) {
    return mins + (mins === 1 ? ' minute ago' : ' minutes ago');
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return hrs + (hrs === 1 ? ' hour ago' : ' hours ago');
  }
  const days = Math.floor(hrs / 24);
  if (days < 30) {
    return days + (days === 1 ? ' day ago' : ' days ago');
  }
  const months = Math.floor(days / 30);
  return months + (months === 1 ? ' month ago' : ' months ago');
}

export function snippet(description: string, max = 140) {
  const flat = String(description || '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max).trimEnd() + '...' : flat;
}

/* Saved jobs live on the phone only. */

const SAVED_KEY = 'scholin_saved_vacancies';

export async function loadSaved() {
  try {
    const raw = await AsyncStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export async function toggleSaved(id: string) {
  const list = await loadSaved();
  const next = list.includes(id) ? list.filter(x => x !== id) : [id].concat(list);
  try {
    await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {}
  return next;
}
