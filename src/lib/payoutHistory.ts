import { supabase } from './supabase';
import { callFunction } from './payments';

export type PayoutPayment = {
  id: string;
  receipt_number: string | null;
  payment_date: string;
  amount: number;
  platform_fee_amount: number | null;
  net_amount_to_school: number | null;
  paystack_reference: string | null;
  settled_at: string | null;
  paystack_settlement_id: string | number | null;
  event_name: string | null;
  student_name: string | null;
  admission_no: string | null;
  payer_name: string;
};

export type PayoutHistory = {
  school_name: string;
  bank_name: string | null;
  account_name: string | null;
  account_last4: string;
  payments: PayoutPayment[];
};

export async function fetchPayoutHistory(schoolId: string): Promise<PayoutHistory> {
  const { data, error } = await supabase.rpc('get_school_online_payments', { p_school_id: schoolId });
  if (error) {
    throw new Error(error.message || 'Could not load payment history.');
  }
  return data as PayoutHistory;
}

// Asks Paystack whether any of this school's payments have been paid out. Safe to fail quietly.
export async function checkPaystackPayouts(schoolId: string) {
  return (await callFunction('sync-school-settlements', { school_id: schoolId }, 'Could not check payments right now.')) as { settlements_synced: number; payments_matched: number };
}

export function maskAccount(last4: string) {
  return last4 ? '******' + last4 : '';
}
