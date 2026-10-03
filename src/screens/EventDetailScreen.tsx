import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar, BottomSheet, Badge, Button, Card, DateField, EmptyState, Input, Notice, OptionField, Screen, SearchBar, Skeleton, SwitchRow } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { confirmAction } from '../lib/confirm';
import { naira, shortDate } from '../lib/format';
import { writeTempFile, shareFile } from '../lib/files';
import { buildReceiptHtml } from '../lib/receiptDoc';
import {
  computeStats,
  deleteEvent,
  EVENT_STATUSES,
  EVENT_TYPES,
  fetchCreateLookups,
  fetchEventDetail,
  getPaymentStatus,
  methodLabel,
  PAY_METHODS,
  recalculateEvent,
  recordPayment,
  setStudentAmount,
  typeLabel,
  updateEvent,
} from '../lib/events';
import { canManageFees } from './EventsScreen';

type Tab = 'overview' | 'students' | 'receipts';
type Tone = { message: string; tone: 'error' | 'success' };

const statusBadge: Record<string, { label: string; tone: any }> = {
  paid: { label: 'Fully paid', tone: 'green' },
  partial: { label: 'Partial', tone: 'orange' },
  not_paid: { label: 'Not paid', tone: 'purple' },
};

function newKey() {
  const hex = () => Math.floor(Math.random() * 16).toString(16);
  const s = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => (c === 'x' ? hex() : ((Math.floor(Math.random() * 4) + 8).toString(16))));
  return s;
}

export default function EventDetailScreen({ navigation, route }: any) {
  const eventId: string = route.params.eventId;
  const { ctx, loading: ctxLoading } = useStaff();
  const [data, setData] = useState<any>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [notice, setNotice] = useState<Tone>({ message: '', tone: 'success' });

  const [payFor, setPayFor] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [override, setOverride] = useState(false);
  const [overrideAmount, setOverrideAmount] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paySheetMsg, setPaySheetMsg] = useState<Tone>({ message: '', tone: 'error' });
  const key = useRef(newKey());

  const [editing, setEditing] = useState(false);
  const [terms, setTerms] = useState<any[]>([]);
  const [eName, setEName] = useState('');
  const [eType, setEType] = useState('other');
  const [eDesc, setEDesc] = useState('');
  const [eAmount, setEAmount] = useState('');
  const [eDue, setEDue] = useState('');
  const [eStatus, setEStatus] = useState('active');
  const [eTerm, setETerm] = useState('');
  const [eMandatory, setEMandatory] = useState(true);
  const [editMsg, setEditMsg] = useState<Tone>({ message: '', tone: 'error' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [recalcAmount, setRecalcAmount] = useState<number | null>(null);
  const [recalcBusy, setRecalcBusy] = useState(false);

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      const d = await fetchEventDetail(ctx.schoolId, eventId);
      if (!d) {
        setMissing(true);
        return;
      }
      setData(d);
    } catch (e: any) {
      setNotice({ message: e.message || 'Could not load this event.', tone: 'error' });
    }
  }, [ctx, eventId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const computed = useMemo(() => (data ? computeStats(data.assignments, data.payments) : null), [data]);

  const rows = useMemo(() => {
    if (!data || !computed) {
      return [];
    }
    const q = query.trim().toLowerCase();
    return data.assignments
      .map((a: any) => {
        const student = a.students || { full_name: 'Unknown', admission_no: '' };
        const paid = computed.paidBy[a.student_id] || 0;
        const { status, balance } = getPaymentStatus(a.amount_due, paid);
        const cls = data.classOf[a.student_id] || { classId: null, className: '' };
        return { a, student, paid, status, balance, cls };
      })
      .filter((r: any) => (!classFilter || r.cls.classId === classFilter) && (!statusFilter || r.status === statusFilter) && (!q || String(r.student.full_name).toLowerCase().includes(q) || String(r.student.admission_no || '').toLowerCase().includes(q)))
      .sort((x: any, y: any) => String(x.student.full_name).localeCompare(String(y.student.full_name)));
  }, [data, computed, query, classFilter, statusFilter]);

  if (ctxLoading || (!data && !missing)) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={70} radius={16} />
          <Skeleton height={150} radius={20} />
          <Skeleton height={150} radius={20} />
        </View>
      </Screen>
    );
  }

  if (!ctx || !canManageFees(ctx)) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Not available" message="Events and Fees is managed by the school owner and authorised teacher admins." />
      </Screen>
    );
  }

  if (missing || !data || !computed) {
    return (
      <Screen>
        <EmptyState icon="info" title="Event not found" message="This event may have been deleted or does not belong to your school." />
        <Button title="Go back" variant="soft" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const ev = data.event;
  const stats = computed.stats;
  const pct = stats.totalExpected > 0 ? Math.round((stats.totalCollected / stats.totalExpected) * 100) : 0;
  const classOptions = [{ value: '', label: 'All classes' }];
  const seen: Record<string, boolean> = {};
  Object.values(data.classOf as Record<string, { classId: string | null; className: string }>).forEach(c => {
    if (c.classId && !seen[c.classId]) {
      seen[c.classId] = true;
      classOptions.push({ value: c.classId, label: c.className });
    }
  });

  const payAssign = payFor ? data.assignments.find((a: any) => a.student_id === payFor) : null;
  const payStudent = payAssign ? payAssign.students || { full_name: 'Student' } : null;
  const payPaid = payFor ? computed.paidBy[payFor] || 0 : 0;
  const payBalance = payAssign ? getPaymentStatus(payAssign.amount_due, payPaid).balance : 0;
  const history = payFor ? data.payments.filter((p: any) => p.student_id === payFor).sort((x: any, y: any) => new Date(y.payment_date).getTime() - new Date(x.payment_date).getTime()) : [];

  const openPay = (studentId: string) => {
    const a = data.assignments.find((x: any) => x.student_id === studentId);
    setPayFor(studentId);
    setAmount('');
    setMethod('cash');
    setNotes('');
    setOverride(false);
    setOverrideAmount(a ? String(a.amount_due) : '');
    setShowAll(false);
    setPaySheetMsg({ message: '', tone: 'error' });
    key.current = newKey();
  };

  const openReceipt = (paymentId: string) => {
    const payment = data.payments.find((p: any) => p.id === paymentId);
    if (!payment) {
      return;
    }
    const a = data.assignments.find((x: any) => x.student_id === payment.student_id);
    const student = (a && a.students) || { full_name: 'Student', admission_no: '' };
    const upTo = data.payments
      .filter((p: any) => p.student_id === payment.student_id && new Date(p.payment_date).getTime() <= new Date(payment.payment_date).getTime())
      .reduce((s: number, p: any) => s + Number(p.amount), 0);
    const html = buildReceiptHtml({
      school: ctx.school,
      student,
      className: (data.classOf[payment.student_id] || { className: '' }).className,
      event: ev,
      payment,
      amountDue: a ? Number(a.amount_due) : Number(ev.amount),
      paidUpToThis: upTo,
    });
    navigation.navigate('Receipt', { html, fileName: 'Receipt_' + String(student.full_name).replace(/\s+/g, '_') + '_' + String(payment.receipt_number || '') });
  };

  const submitPayment = async () => {
    const value = parseFloat(amount);
    if (!payFor || isNaN(value) || value <= 0) {
      setPaySheetMsg({ message: 'Please enter a valid amount.', tone: 'error' });
      return;
    }
    setPaying(true);
    setPaySheetMsg({ message: '', tone: 'error' });
    try {
      const result = await recordPayment(eventId, payFor, value, method, notes.trim(), key.current);
      key.current = newKey();
      setAmount('');
      setData({ ...data, payments: [result].concat(data.payments.filter((p: any) => p.id !== result.id)) });
      setPaySheetMsg({ message: 'Payment recorded.', tone: 'success' });
      setPayFor(null);
      setTimeout(() => {
        navigation.navigate('Receipt', {
          html: buildReceiptHtml({
            school: ctx.school,
            student: payStudent,
            className: (data.classOf[payFor] || { className: '' }).className,
            event: ev,
            payment: result,
            amountDue: Number(payAssign.amount_due),
            paidUpToThis: payPaid + Number(result.amount),
          }),
          fileName: 'Receipt_' + String(payStudent.full_name).replace(/\s+/g, '_') + '_' + String(result.receipt_number || ''),
        });
      }, 250);
    } catch (e: any) {
      setPaySheetMsg({ message: e.message, tone: 'error' });
    }
    setPaying(false);
  };

  const saveOverride = async () => {
    const value = parseFloat(overrideAmount);
    if (!payFor || isNaN(value) || value < 0) {
      setPaySheetMsg({ message: 'Please enter a valid amount.', tone: 'error' });
      return;
    }
    try {
      await setStudentAmount(eventId, payFor, value);
      setData({ ...data, assignments: data.assignments.map((a: any) => (a.student_id === payFor ? { ...a, amount_due: value, is_override: true } : a)) });
      setOverride(false);
      setPaySheetMsg({ message: 'Amount updated for this student.', tone: 'success' });
    } catch (e: any) {
      setPaySheetMsg({ message: e.message, tone: 'error' });
    }
  };

  const openEdit = async () => {
    setEName(ev.name);
    setEType(ev.event_type);
    setEDesc(ev.description || '');
    setEAmount(String(ev.amount));
    setEDue(ev.due_date || '');
    setEStatus(ev.status);
    setETerm(ev.term_id || '');
    setEMandatory(ev.is_mandatory !== false);
    setRecalcAmount(null);
    setEditMsg({ message: '', tone: 'error' });
    setEditing(true);
    if (terms.length === 0) {
      try {
        setTerms((await fetchCreateLookups(ctx.schoolId)).terms);
      } catch {}
    }
  };

  const saveEdit = async () => {
    const value = parseFloat(eAmount);
    if (!eName.trim()) {
      setEditMsg({ message: 'Please enter an event name.', tone: 'error' });
      return;
    }
    if (isNaN(value) || value < 0) {
      setEditMsg({ message: 'Please enter a valid amount.', tone: 'error' });
      return;
    }
    setSavingEdit(true);
    try {
      await updateEvent(eventId, { name: eName.trim(), eventType: eType, description: eDesc.trim(), dueDate: eDue, status: eStatus, termId: eTerm, mandatory: eMandatory });
      const changed = Number(value) !== Number(ev.amount);
      setData({ ...data, event: { ...ev, name: eName.trim(), event_type: eType, description: eDesc.trim(), due_date: eDue || null, status: eStatus, term_id: eTerm || null, is_mandatory: eMandatory } });
      if (changed) {
        setRecalcAmount(value);
        setEditMsg({ message: 'Details saved. Recalculate below to apply the new amount.', tone: 'success' });
      } else {
        setEditing(false);
        setNotice({ message: 'Event updated.', tone: 'success' });
      }
    } catch (e: any) {
      setEditMsg({ message: e.message, tone: 'error' });
    }
    setSavingEdit(false);
  };

  const runRecalc = async () => {
    if (recalcAmount === null) {
      return;
    }
    setRecalcBusy(true);
    try {
      await recalculateEvent(eventId, recalcAmount);
      setEditing(false);
      setRecalcAmount(null);
      setNotice({ message: 'Event recalculated. Student balances and totals are updated.', tone: 'success' });
      await load();
    } catch (e: any) {
      setEditMsg({ message: e.message, tone: 'error' });
    }
    setRecalcBusy(false);
  };

  const removeEvent = () => {
    const n = data.payments.length;
    confirmAction(
      'Delete event',
      n > 0
        ? 'This event has ' + n + (n === 1 ? ' payment' : ' payments') + '. Deleting removes it from the active list. The payment history is kept for records.'
        : 'Delete "' + ev.name + '"?',
      'Delete',
      async () => {
        try {
          await deleteEvent(eventId);
          navigation.goBack();
        } catch (e: any) {
          setNotice({ message: e.message, tone: 'error' });
        }
      },
    );
  };

  const exportReport = async () => {
    const q = (v: any) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const lines: string[] = [['Student Name', 'Admission No.', 'Class', 'Amount Due', 'Total Paid', 'Balance', 'Status'].map(q).join(',')];
    data.assignments.forEach((a: any) => {
      const s = a.students || {};
      const paid = computed.paidBy[a.student_id] || 0;
      const { status, balance } = getPaymentStatus(a.amount_due, paid);
      lines.push([s.full_name, s.admission_no, (data.classOf[a.student_id] || { className: '' }).className, a.amount_due, paid, balance, status.replace('_', ' ')].map(q).join(','));
    });
    lines.push('');
    lines.push([q('Total Students'), q(stats.studentCount)].join(','));
    lines.push([q('Total Expected'), q(stats.totalExpected)].join(','));
    lines.push([q('Total Collected'), q(stats.totalCollected)].join(','));
    lines.push([q('Total Outstanding'), q(stats.totalOutstanding)].join(','));
    try {
      const name = 'Event_Report_' + String(ev.name).replace(/[^A-Za-z0-9]+/g, '_') + '.csv';
      const path = await writeTempFile(name, lines.join('\n'));
      await shareFile(path, 'text/csv', name);
    } catch (e: any) {
      setNotice({ message: e.message || 'Could not export the report.', tone: 'error' });
    }
  };

  const receipts = data.payments.slice().sort((x: any, y: any) => new Date(y.payment_date).getTime() - new Date(x.payment_date).getTime());

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={[text.h3, { color: colors.text }]}>{ev.name}</Text>
            <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>{typeLabel(ev.event_type) + ' · ' + naira(Number(ev.amount)) + ' per student'}</Text>
          </View>
          <Badge label={String(ev.status).charAt(0).toUpperCase() + String(ev.status).slice(1)} tone={ev.status === 'active' ? 'green' : ev.status === 'upcoming' ? 'blue' : ev.status === 'completed' ? 'purple' : 'orange'} />
        </View>
        <View style={styles.actions}>
          <Button title="Edit event" variant="soft" icon="edit" onPress={openEdit} style={{ flex: 1 }} />
          <Button title="Delete" variant="danger" icon="trash" onPress={removeEvent} style={{ flex: 1 }} />
        </View>
        <Notice message={notice.message} tone={notice.tone} />

        <View style={styles.tabs}>
          {(['overview', 'students', 'receipts'] as Tab[]).map(t => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
              <Text style={[text.small, styles.tabText, tab === t && { color: '#FFFFFF' }]}>{t === 'overview' ? 'Overview' : t === 'students' ? 'Students' : 'Receipts'}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'overview' ? (
          <View>
            <Card>
              <Text style={[text.small, { color: colors.textMuted }]}>Collected</Text>
              <Text style={[text.h2, { color: colors.text }]}>{naira(stats.totalCollected)}</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>{'of ' + naira(stats.totalExpected) + ' expected'}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: (Math.min(100, pct) + '%') as any }]} />
              </View>
              <View style={styles.between}>
                <Text style={[text.bodyStrong, { color: colors.danger }]}>{naira(stats.totalOutstanding) + ' outstanding'}</Text>
                <Text style={[text.bodyStrong, { color: colors.primary }]}>{pct + '%'}</Text>
              </View>
            </Card>
            <View style={styles.grid}>
              <Mini label="Students" value={stats.studentCount} color={colors.text} />
              <Mini label="Fully paid" value={stats.paidCount} color={colors.success} />
              <Mini label="Partial" value={stats.partialCount} color={colors.accentDark} />
              <Mini label="Not paid" value={stats.notPaidCount} color={colors.danger} />
            </View>
            <Card style={{ marginTop: spacing.md }}>
              <Info label="Event type" value={typeLabel(ev.event_type)} />
              <Info label="Amount per student" value={naira(Number(ev.amount))} />
              <Info label="Due date" value={ev.due_date ? shortDate(ev.due_date) : 'Not set'} />
              <Info label="Mandatory" value={ev.is_mandatory === false ? 'No' : 'Yes'} />
              <Info label="Description" value={ev.description || 'None'} />
              <Info label="Created" value={shortDate(ev.created_at)} last />
            </Card>
            <Button title="Export event report" variant="soft" onPress={exportReport} style={{ marginTop: spacing.lg }} />
          </View>
        ) : null}

        {tab === 'students' ? (
          <View>
            <SearchBar value={query} onChange={setQuery} placeholder="Search by name or admission number" />
            <View style={{ marginTop: spacing.md }}>
              <OptionField compact label="Class" value={classFilter} options={classOptions} onChange={setClassFilter} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
              {[{ v: '', l: 'All' }, { v: 'paid', l: 'Fully paid' }, { v: 'partial', l: 'Partial' }, { v: 'not_paid', l: 'Not paid' }].map(f => (
                <Pressable key={f.v} onPress={() => setStatusFilter(f.v)} style={[styles.chip, statusFilter === f.v && styles.tabOn]}>
                  <Text style={[text.small, styles.tabText, statusFilter === f.v && { color: '#FFFFFF' }]}>{f.l}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {data.assignments.length === 0 ? <EmptyState icon="users" title="No students" message="No students have been assigned to this event." /> : null}
            {data.assignments.length > 0 && rows.length === 0 ? <EmptyState icon="search" title="No students found" message="Try a different search or filter." /> : null}
            {rows.map((r: any) => {
              const due = Number(r.a.amount_due) || 0;
              const p = due > 0 ? Math.min(100, Math.round((r.paid / due) * 100)) : 0;
              const b = statusBadge[r.status];
              return (
                <Pressable key={r.a.student_id} onPress={() => openPay(r.a.student_id)}>
                  <Card style={{ marginBottom: spacing.md }}>
                    <View style={styles.rowTop}>
                      <Avatar name={r.student.full_name} uri={r.student.photo_url || undefined} size={46} />
                      <View style={{ flex: 1 }}>
                        <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{r.student.full_name}</Text>
                        <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>{[r.student.admission_no, r.cls.className].filter(Boolean).join(' · ')}</Text>
                      </View>
                      <Badge label={b.label} tone={b.tone} />
                    </View>
                    <View style={styles.amounts}>
                      <Amount label="Due" value={naira(due)} />
                      <Amount label="Paid" value={naira(r.paid)} />
                      <Amount label="Balance" value={naira(r.balance)} danger={r.balance > 0} />
                    </View>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: (p + '%') as any }]} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {tab === 'receipts' ? (
          <View>
            {receipts.length === 0 ? <EmptyState icon="receipt" title="No receipts yet" message="No payments have been recorded for this event yet." /> : null}
            {receipts.map((p: any) => {
              const a = data.assignments.find((x: any) => x.student_id === p.student_id);
              const s = (a && a.students) || { full_name: 'Unknown' };
              return (
                <Card key={p.id} style={{ marginBottom: spacing.md }}>
                  <View style={styles.between}>
                    <View style={{ flex: 1 }}>
                      <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{s.full_name}</Text>
                      <Text style={[text.small, { color: colors.textMuted }]}>{p.receipt_number + ' · ' + shortDate(p.payment_date)}</Text>
                    </View>
                    <Text style={[text.bodyStrong, { color: colors.success }]}>{naira(Number(p.amount))}</Text>
                  </View>
                  <Button title="View receipt" variant="soft" onPress={() => openReceipt(p.id)} style={{ marginTop: spacing.md, height: 42 }} />
                </Card>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <BottomSheet visible={!!payFor} onClose={() => setPayFor(null)} title={payStudent ? payStudent.full_name : 'Record payment'}>
        <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Notice message={paySheetMsg.message} tone={paySheetMsg.tone} />
          <View style={styles.sum}>
            <Amount label="Amount due" value={payAssign ? naira(Number(payAssign.amount_due)) : ''} />
            <Amount label="Total paid" value={naira(payPaid)} />
            <Amount label="Balance" value={naira(payBalance)} danger={payBalance > 0} />
          </View>
          {payBalance > 0 ? (
            <View>
              <Input label="Amount received" value={amount} onChangeText={v => setAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder={'Up to ' + naira(payBalance)} />
              <OptionField label="Payment method" value={method} options={PAY_METHODS} onChange={setMethod} />
              <Input label="Notes (optional)" value={notes} onChangeText={setNotes} maxLength={300} />
              <Button title="Record payment" loading={paying} onPress={submitPayment} />
            </View>
          ) : (
            <Notice message="This student has paid in full." tone="success" />
          )}

          <Pressable onPress={() => setOverride(!override)} style={{ marginTop: spacing.lg }}>
            <Text style={[text.bodyStrong, { color: colors.primary }]}>{override ? 'Hide amount change' : 'Change amount for this student'}</Text>
          </Pressable>
          {override ? (
            <View style={{ marginTop: spacing.md }}>
              <Input label="New amount due" value={overrideAmount} onChangeText={v => setOverrideAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
              <Button title="Save amount" variant="soft" onPress={saveOverride} />
            </View>
          ) : null}

          <Text style={[text.bodyStrong, { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.sm }]}>Payment history</Text>
          {history.length === 0 ? <Text style={[text.small, { color: colors.textMuted }]}>No payments recorded yet for this student.</Text> : null}
          {(showAll ? history : history.slice(0, 3)).map((p: any) => (
            <Pressable key={p.id} onPress={() => { setPayFor(null); setTimeout(() => openReceipt(p.id), 250); }} style={styles.hist}>
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, { color: colors.text }]}>{naira(Number(p.amount))}</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{shortDate(p.payment_date) + ' · ' + methodLabel(p.payment_method) + ' · ' + p.receipt_number}</Text>
              </View>
              <Text style={[text.small, { color: colors.primary }]}>Receipt</Text>
            </Pressable>
          ))}
          {history.length > 3 && !showAll ? <Button title="View all" variant="ghost" onPress={() => setShowAll(true)} /> : null}
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={editing} onClose={() => setEditing(false)} title="Edit event">
        <ScrollView style={{ maxHeight: 560 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Notice message={editMsg.message} tone={editMsg.tone} />
          <Input label="Event name" value={eName} onChangeText={setEName} />
          <OptionField label="Event type" value={eType} options={EVENT_TYPES} onChange={setEType} />
          <Input label="Description (optional)" value={eDesc} onChangeText={setEDesc} multiline maxLength={500} />
          <Input label="Amount per student" value={eAmount} onChangeText={v => setEAmount(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
          <DateField label="Due date (optional)" value={eDue} onChange={setEDue} allowFuture />
          <OptionField label="Status" value={eStatus} options={EVENT_STATUSES} onChange={setEStatus} />
          <OptionField label="Term (optional)" value={eTerm} options={[{ value: '', label: 'Not tied to a specific term' }].concat(terms.map(t => ({ value: t.id, label: t.name })))} onChange={setETerm} />
          <SwitchRow label="Mandatory fee" value={eMandatory} onChange={setEMandatory} />
          {recalcAmount !== null ? (
            <Card style={{ marginVertical: spacing.md }}>
              <Text style={[text.bodyStrong, { color: colors.text }]}>Apply the new amount</Text>
              <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.sm }]}>
                {'This changes the amount from ' + naira(Number(ev.amount)) + ' to ' + naira(recalcAmount) + ' for ' + data.assignments.length + ' students. Existing payments are not deleted. Students with their own amount keep it.'}
              </Text>
              <Button title="Recalculate event" loading={recalcBusy} onPress={runRecalc} />
            </Card>
          ) : (
            <Button title="Save changes" loading={savingEdit} onPress={saveEdit} style={{ marginTop: spacing.md }} />
          )}
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

function Mini({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.mini}>
      <Text style={[text.h3, { color }]}>{value}</Text>
      <Text style={[text.small, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function Info({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.info, last && { borderBottomWidth: 0 }]}>
      <Text style={[text.small, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[text.small, { color: colors.text, flex: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

function Amount({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[text.bodyStrong, { color: danger ? colors.danger : colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[text.small, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.lg },
  tabs: { flexDirection: 'row', backgroundColor: '#EEF1F6', borderRadius: radius.lg, padding: 4, marginBottom: spacing.lg },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md },
  tabOn: { backgroundColor: colors.primary },
  tabText: { fontFamily: fonts.semibold, color: colors.textMuted },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: '#EEF1F6' },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', marginTop: spacing.md, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  mini: { flexGrow: 1, flexBasis: '46%', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  info: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  amounts: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  sum: { flexDirection: 'row', gap: spacing.md, backgroundColor: '#F4F6FA', borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  hist: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
