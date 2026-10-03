import { supabase } from './supabase';
import { toISODateLocal } from './format';

function fail(error: any, fallback: string): never {
  throw new Error((error && error.message) || fallback);
}

export const EVENT_TYPES: { value: string; label: string }[] = [
  { value: 'school_fees', label: 'School Fees' },
  { value: 'summer_lesson', label: 'Summer Lesson' },
  { value: 'examination', label: 'Examination Fee' },
  { value: 'excursion', label: 'Excursion' },
  { value: 'graduation', label: 'Graduation' },
  { value: 'party', label: 'School Party' },
  { value: 'pta', label: 'PTA Levy' },
  { value: 'sports', label: 'Sports Fee' },
  { value: 'books', label: 'Textbook Fee' },
  { value: 'uniform', label: 'Uniform Fee' },
  { value: 'other', label: 'Other' },
];

export const EVENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

export const PAY_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'pos', label: 'POS' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export function typeLabel(value: string) {
  const t = EVENT_TYPES.find(x => x.value === value);
  return t ? t.label : 'Other';
}

export function methodLabel(value: string) {
  if (value === 'online') {
    return 'Online';
  }
  const m = PAY_METHODS.find(x => x.value === value);
  return m ? m.label : 'Other';
}

// The single rule for a payment status. Every screen uses this one function.
export function getPaymentStatus(amountDue: number, totalPaid: number) {
  const due = Number(amountDue) || 0;
  const paid = Number(totalPaid) || 0;
  const balance = Math.max(0, due - paid);
  if (paid <= 0) {
    return { status: 'not_paid' as const, balance };
  }
  if (balance <= 0) {
    return { status: 'paid' as const, balance: 0 };
  }
  return { status: 'partial' as const, balance };
}

export type EventStats = {
  studentCount: number;
  totalExpected: number;
  totalCollected: number;
  totalOutstanding: number;
  paidCount: number;
  partialCount: number;
  notPaidCount: number;
};

export function computeStats(assignments: any[], payments: any[]) {
  const paidBy: Record<string, number> = {};
  payments.forEach(p => {
    paidBy[p.student_id] = (paidBy[p.student_id] || 0) + Number(p.amount);
  });
  const s: EventStats = { studentCount: assignments.length, totalExpected: 0, totalCollected: 0, totalOutstanding: 0, paidCount: 0, partialCount: 0, notPaidCount: 0 };
  assignments.forEach(a => {
    const paid = paidBy[a.student_id] || 0;
    const due = Number(a.amount_due);
    s.totalExpected += due;
    s.totalCollected += Math.min(paid, due);
    const { status } = getPaymentStatus(due, paid);
    if (status === 'paid') {
      s.paidCount++;
    } else if (status === 'partial') {
      s.partialCount++;
    } else {
      s.notPaidCount++;
    }
  });
  s.totalOutstanding = Math.max(0, s.totalExpected - s.totalCollected);
  return { stats: s, paidBy };
}

export async function fetchEventsWithStats(schoolId: string) {
  const { data: events, error } = await supabase.from('events').select('*').eq('school_id', schoolId).is('deleted_at', null).order('created_at', { ascending: false });
  if (error) {
    fail(error, 'Could not load events.');
  }
  const list = events || [];
  if (list.length === 0) {
    return [];
  }
  const ids = list.map((e: any) => e.id);
  const [assign, pays] = await Promise.all([
    supabase.from('event_students').select('event_id, student_id, amount_due').in('event_id', ids),
    supabase.from('event_payments').select('event_id, student_id, amount').in('event_id', ids).eq('status', 'valid'),
  ]);
  const aBy: Record<string, any[]> = {};
  (assign.data || []).forEach((a: any) => {
    (aBy[a.event_id] = aBy[a.event_id] || []).push(a);
  });
  const pBy: Record<string, any[]> = {};
  (pays.data || []).forEach((p: any) => {
    (pBy[p.event_id] = pBy[p.event_id] || []).push(p);
  });
  return list.map((e: any) => ({ ...e, stats: computeStats(aBy[e.id] || [], pBy[e.id] || []).stats })) as any[];
}

export async function fetchCreateLookups(schoolId: string) {
  const [classes, students, session] = await Promise.all([
    supabase.from('classes').select('id, name, arm').eq('school_id', schoolId).order('name'),
    supabase.from('students').select('id, full_name, admission_no').eq('school_id', schoolId).order('full_name'),
    supabase.from('sessions').select('id').eq('school_id', schoolId).eq('is_current', true).maybeSingle(),
  ]);
  let terms: any[] = [];
  if (session.data) {
    const t = await supabase.from('terms').select('id, name').eq('session_id', session.data.id).order('created_at');
    terms = t.data || [];
  }
  return { classes: (classes.data || []) as any[], students: (students.data || []) as any[], terms };
}

export type NewEvent = {
  name: string;
  eventType: string;
  description: string;
  amount: number;
  dueDate: string;
  termId: string;
  mandatory: boolean;
  assignment: 'all_students' | 'classes' | 'students';
  status: string;
  classIds: string[];
  studentIds: string[];
};

export async function createEvent(schoolId: string, userId: string, ev: NewEvent) {
  const { data: event, error } = await supabase
    .from('events')
    .insert({
      school_id: schoolId,
      name: ev.name,
      event_type: ev.eventType,
      description: ev.description || null,
      amount: ev.amount,
      due_date: ev.dueDate || null,
      status: ev.status,
      term_id: ev.termId || null,
      is_mandatory: ev.mandatory,
      assignment_type: ev.assignment,
      created_by: userId,
    })
    .select()
    .single();
  if (error || !event) {
    fail(error, 'Could not create event.');
  }
  const { error: assignError } = await supabase.rpc('assign_students_to_event', {
    p_event_id: event.id,
    p_assignment_type: ev.assignment,
    p_class_ids: ev.assignment === 'classes' ? ev.classIds : null,
    p_student_ids: ev.assignment === 'students' ? ev.studentIds : null,
  });
  if (assignError) {
    throw new Error('Event created, but assigning students failed: ' + assignError.message);
  }
  return event as any;
}

export async function fetchEventDetail(schoolId: string, eventId: string) {
  const { data: event, error } = await supabase.from('events').select('*').eq('id', eventId).eq('school_id', schoolId).is('deleted_at', null).single();
  if (error || !event) {
    return null;
  }
  const { data: session } = await supabase.from('sessions').select('id').eq('school_id', schoolId).eq('is_current', true).limit(1).maybeSingle();
  const [assign, pays, history] = await Promise.all([
    supabase.from('event_students').select('*, students(id, full_name, admission_no, photo_url)').eq('event_id', eventId),
    supabase.from('event_payments').select('*').eq('event_id', eventId).eq('status', 'valid').order('payment_date', { ascending: false }),
    session ? supabase.from('student_class_history').select('student_id, class_id, classes(name, arm)').eq('session_id', session.id) : Promise.resolve({ data: [] as any[] }),
  ]);
  const classOf: Record<string, { classId: string | null; className: string }> = {};
  ((history.data || []) as any[]).forEach(h => {
    classOf[h.student_id] = { classId: h.class_id, className: h.classes ? h.classes.name + (h.classes.arm ? ' ' + h.classes.arm : '') : '' };
  });
  return { event: event as any, assignments: (assign.data || []) as any[], payments: (pays.data || []) as any[], classOf };
}

export async function recordPayment(eventId: string, studentId: string, amount: number, method: string, notes: string, key: string) {
  const { data, error } = await supabase.rpc('record_event_payment', {
    p_event_id: eventId,
    p_student_id: studentId,
    p_amount: amount,
    p_payment_method: method,
    p_notes: notes || null,
    p_idempotency_key: key,
  });
  if (error) {
    fail(error, 'Could not record payment.');
  }
  return data as any;
}

export async function setStudentAmount(eventId: string, studentId: string, amount: number) {
  const { error } = await supabase
    .from('event_students')
    .update({ amount_due: amount, is_override: true, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('student_id', studentId);
  if (error) {
    fail(error, 'Could not update this student amount.');
  }
}

export async function updateEvent(eventId: string, patch: { name: string; eventType: string; description: string; dueDate: string; status: string; termId: string; mandatory: boolean }) {
  const { error } = await supabase
    .from('events')
    .update({
      name: patch.name,
      event_type: patch.eventType,
      description: patch.description || null,
      due_date: patch.dueDate || null,
      status: patch.status,
      term_id: patch.termId || null,
      is_mandatory: patch.mandatory,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId);
  if (error) {
    fail(error, 'Could not save changes.');
  }
}

export async function recalculateEvent(eventId: string, amount: number) {
  const { error } = await supabase.rpc('recalculate_event', { p_event_id: eventId, p_new_amount: amount });
  if (error) {
    fail(error, 'Could not recalculate event.');
  }
}

export async function deleteEvent(eventId: string) {
  const { error } = await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', eventId);
  if (error) {
    fail(error, 'Could not delete event.');
  }
}

export function todayIso() {
  return toISODateLocal(new Date());
}
