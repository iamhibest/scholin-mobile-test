import { supabase } from './supabase';
import { callFunction } from './payments';

export type FeeDetail = {
  event: any;
  amountDue: number;
  payments: any[];
  totalPaid: number;
  owed: number;
  school: any;
  student: any;
  className: string;
  pendingIntent: { id: string; reference: string | null } | null;
};

export async function fetchFeeDetail(eventId: string, studentId: string): Promise<FeeDetail> {
  const [ev, assigned, pays, student] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).single(),
    supabase.from('event_students').select('amount_due').eq('event_id', eventId).eq('student_id', studentId).maybeSingle(),
    supabase.from('event_payments').select('id, amount, payment_method, payment_date, receipt_number, status').eq('event_id', eventId).eq('student_id', studentId).eq('status', 'valid').order('payment_date', { ascending: false }),
    supabase.from('students').select('full_name, admission_no, school_id').eq('id', studentId).single(),
  ]);
  if (ev.error || !ev.data) {
    throw new Error('Could not load this fee.');
  }
  const payments = pays.data || [];
  const amountDue = Number(assigned.data ? assigned.data.amount_due : ev.data.amount || 0);
  const totalPaid = payments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  let school: any = null;
  let className = '-';
  if (student.data) {
    school = (await supabase.from('schools').select('*').eq('id', student.data.school_id).single()).data;
    const { data: history } = await supabase
      .from('student_class_history')
      .select('classes(name, arm)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const c: any = history && (history as any).classes;
    className = c ? (c.arm ? c.name + ' ' + c.arm : c.name) : '-';
  }

  const { data: intent } = await supabase
    .from('event_payment_intents')
    .select('id, payment_reference, payment_status')
    .eq('event_id', eventId)
    .eq('student_id', studentId)
    .eq('payment_status', 'pending')
    .not('payment_reference', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    event: ev.data,
    amountDue,
    payments,
    totalPaid,
    owed: Math.max(0, amountDue - totalPaid),
    school,
    student: student.data,
    className,
    pendingIntent: intent ? { id: (intent as any).id, reference: (intent as any).payment_reference } : null,
  };
}

export async function startFeePayment(eventId: string, studentId: string, amount: number) {
  const r = await callFunction('create-fee-payment', { event_id: eventId, student_id: studentId, amount }, 'Could not start this payment. Please try again.');
  if (!r.authorization_url || !r.reference || !r.intent_id) {
    throw new Error('Payment could not be started. Please make sure the app and the payment function are both on the latest version.');
  }
  return { url: r.authorization_url as string, reference: r.reference as string, intentId: r.intent_id as string, amount: Number(r.amount_charged) };
}
