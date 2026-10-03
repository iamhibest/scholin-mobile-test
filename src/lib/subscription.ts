import { supabase } from './supabase';
import { callFunction, Checkout } from './payments';

export const PRESET_MONTHS = [4, 8, 12];

export type Tier = { min_months: number; discount_percent: number };

export async function fetchPricing() {
  const [settings, tiers] = await Promise.all([
    supabase.from('app_settings').select('subscription_price_per_month').limit(1).maybeSingle(),
    supabase.from('subscription_discount_tiers').select('*').order('min_months', { ascending: false }),
  ]);
  return {
    pricePerMonth: settings.data ? Number(settings.data.subscription_price_per_month) : 0,
    tiers: ((tiers.data || []) as any[]).map(t => ({ min_months: Number(t.min_months), discount_percent: Number(t.discount_percent) })) as Tier[],
  };
}

// Preview only. The server works out the real amount again before anything is charged.
export function calculatePrice(months: number, pricePerMonth: number, tiers: Tier[]) {
  const base = months * pricePerMonth;
  const tier = tiers.find(t => months >= t.min_months);
  const percent = tier ? tier.discount_percent : 0;
  const discount = base * (percent / 100);
  return { base, percent, discount, total: base - discount };
}

export async function fetchSchoolFresh(schoolId: string) {
  const { data } = await supabase.from('schools').select('*').eq('id', schoolId).single();
  return data as any;
}

export async function fetchPending(schoolId: string) {
  const { data } = await supabase.from('subscription_payments').select('*').eq('school_id', schoolId).eq('payment_status', 'pending').order('created_at', { ascending: false });
  return (data || []) as any[];
}

export async function startSubscription(schoolId: string, months: number): Promise<Checkout> {
  const r = await callFunction('create-subscription-payment', { school_id: schoolId, months }, 'Could not start this payment. Please try again.');
  if (!r.authorization_url) {
    throw new Error('Payment could not be started. Please try again.');
  }
  return { url: r.authorization_url, reference: r.reference, paymentId: r.payment_id, amount: Number(r.amount_charged) };
}

export async function restartSubscription(paymentId: string): Promise<Checkout | null> {
  const r = await callFunction('reinitialize-subscription-payment', { payment_id: paymentId }, 'Could not restart this payment. Please try again.');
  if (r.already_paid) {
    return null;
  }
  if (!r.authorization_url) {
    throw new Error('Payment could not be restarted. Please try again.');
  }
  return { url: r.authorization_url, reference: r.reference, paymentId };
}

export async function deletePending(paymentId: string) {
  const { error } = await supabase.from('subscription_payments').delete().eq('id', paymentId).eq('payment_status', 'pending');
  if (error) {
    throw new Error(error.message || 'Could not delete this payment.');
  }
}
