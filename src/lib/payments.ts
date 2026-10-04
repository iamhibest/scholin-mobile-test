import { supabase } from './supabase';

// Every payment is created, priced and confirmed on the server. The app only
// asks the server to start a payment, opens the checkout link the server
// returns, and asks the server to confirm the result. No keys, prices or
// payment addresses live in the app.

export type PayKind = 'subscription' | 'fee';

export type Checkout = { url: string; reference: string; paymentId: string; amount?: number };

type Kind = { table: string; verifyFn: string; idField: string };

const KINDS: Record<PayKind, Kind> = {
  subscription: { table: 'subscription_payments', verifyFn: 'verify-subscription-payment', idField: 'payment_id' },
  fee: { table: 'event_payment_intents', verifyFn: 'verify-fee-payment', idField: 'intent_id' },
};

export async function functionError(error: any, fallback: string) {
  try {
    if (error && error.context && typeof error.context.json === 'function') {
      const body = await error.context.json();
      if (body && body.error) {
        return String(body.error);
      }
    }
  } catch {}
  return fallback;
}

export async function callFunction(name: string, body: any, fallback: string) {
  let result: any;
  try {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (error) {
      throw new Error(await functionError(error, fallback));
    }
    result = data;
  } catch (e: any) {
    if (e && e.message && e.message !== 'Network request failed' && !/Failed to send/i.test(e.message)) {
      throw e;
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
  if (!result || result.error) {
    throw new Error((result && result.error) || fallback);
  }
  return result;
}

export async function readPaymentStatus(kind: PayKind, paymentId: string) {
  const { data } = await supabase.from(KINDS[kind].table).select('payment_status').eq('id', paymentId).maybeSingle();
  return data ? (data.payment_status as string) : null;
}

export async function verifyPayment(kind: PayKind, reference: string, paymentId: string) {
  await callFunction(KINDS[kind].verifyFn, { reference, [KINDS[kind].idField]: paymentId }, 'Payment could not be verified. Please try again.');
}

export async function requeryPayment(kind: PayKind, paymentId: string) {
  const { data } = await supabase.from(KINDS[kind].table).select('id, payment_reference, payment_status').eq('id', paymentId).maybeSingle();
  if (!data) {
    throw new Error('Could not load this payment to check its status.');
  }
  if (data.payment_status === 'paid') {
    return;
  }
  if (!data.payment_reference) {
    throw new Error('No payment attempt found yet. Use Pay now to start one.');
  }
  await verifyPayment(kind, data.payment_reference, data.id);
}
