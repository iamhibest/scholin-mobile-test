import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Badge, Button, Card, EmptyState, Icon, Notice, Screen, Skeleton } from '../components';
import { IconName } from '../components/Icon';
import { colors, fonts, radius, spacing, text } from '../theme';
import { naira, shortDate } from '../lib/format';
import { getPaymentStatus, methodLabel } from '../lib/events';
import { buildReceiptHtml } from '../lib/receiptDoc';
import { FeeDetail, fetchFeeDetail, startFeePayment } from '../lib/parentFees';
import { requeryPayment } from '../lib/payments';

const icons: Record<string, IconName> = {
  school_fees: 'card', examination: 'file', excursion: 'pin', graduation: 'cap', party: 'gift',
  pta: 'users', sports: 'trend', books: 'book', uniform: 'tags', other: 'receipt',
};

export default function ParentFeeDetailScreen({ navigation, route }: any) {
  const { eventId, studentId, studentName } = route.params;
  const [d, setD] = useState<FeeDetail | null>(null);
  const [failed, setFailed] = useState(false);
  const [part, setPart] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  const load = useCallback(async () => {
    try {
      setD(await fetchFeeDetail(eventId, studentId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [eventId, studentId]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: 'Fee details' });
      load();
    }, [load, navigation]),
  );

  const typed = parseFloat(amount);
  const payAmount = d ? (part ? (isNaN(typed) || typed <= 0 ? 0 : Math.min(typed, d.owed)) : d.owed) : 0;

  const pay = async () => {
    if (!d) {
      return;
    }
    if (!payAmount) {
      setNotice({ message: 'Please enter a valid amount to pay.', tone: 'error' });
      return;
    }
    setBusy(true);
    setNotice({ message: '', tone: 'success' });
    try {
      const r = await startFeePayment(eventId, studentId, payAmount);
      navigation.navigate('PaymentCheckout', { kind: 'fee', url: r.url, reference: r.reference, paymentId: r.intentId, amountLabel: naira(r.amount) });
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy(false);
  };

  const checkPending = async () => {
    if (!d || !d.pendingIntent) {
      return;
    }
    setChecking(true);
    setNotice({ message: '', tone: 'success' });
    try {
      await requeryPayment('fee', d.pendingIntent.id);
      setNotice({ message: 'Payment confirmed. Your fee record has been updated.', tone: 'success' });
      await load();
    } catch (e: any) {
      setNotice({ message: e.message || 'This payment has not been confirmed yet.', tone: 'error' });
    }
    setChecking(false);
  };

  const openReceipt = (p: any) => {
    if (!d || !d.school || !d.student) {
      return;
    }
    const upTo = d.payments.filter(x => new Date(x.payment_date) <= new Date(p.payment_date)).reduce((sum, x) => sum + Number(x.amount), 0);
    const html = buildReceiptHtml({ school: d.school, student: d.student, className: d.className, event: d.event, payment: p, amountDue: d.amountDue, paidUpToThis: upTo });
    navigation.navigate('Receipt', { html, fileName: 'Receipt_' + String(d.student.full_name).replace(/\s+/g, '_') + '_' + String(p.receipt_number || '') });
  };

  if (failed) {
    return (
      <Screen>
        <EmptyState icon="info" title="Could not load this fee" actionLabel="Try again" onAction={load} />
      </Screen>
    );
  }

  if (!d) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={170} radius={24} />
          <Skeleton height={160} radius={24} />
        </View>
      </Screen>
    );
  }

  const status = getPaymentStatus(d.amountDue, d.totalPaid);
  const ev = d.event;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card style={styles.hero}>
          <View style={styles.heroIcon}>
            <Icon name={icons[ev.event_type] || 'receipt'} size={30} color={colors.primary} />
          </View>
          <Text style={[text.h2, styles.center, { color: colors.text }]}>{ev.name}</Text>
          <Text style={[text.small, styles.center, { color: colors.textMuted }]}>{studentName}</Text>
          <Text style={[styles.bigAmount, { color: d.owed > 0 ? colors.danger : colors.success }]}>{naira(d.owed)}</Text>
          <Text style={[text.small, { color: colors.textMuted }]}>{d.owed > 0 ? 'outstanding' : 'fully paid'}</Text>
        </Card>

        <Card style={styles.block}>
          {[
            ['Total amount', naira(d.amountDue)],
            ['Amount paid', naira(d.totalPaid)],
            ['Balance due', naira(d.owed)],
            ['Due date', ev.due_date ? shortDate(ev.due_date) : 'Not set'],
          ].map(([k, v], i) => (
            <View key={k} style={[styles.row, i > 0 && styles.divider]}>
              <Text style={[text.body, { color: colors.textMuted }]}>{k}</Text>
              <Text style={[text.bodyStrong, { color: k === 'Balance due' && d.owed > 0 ? colors.danger : colors.text }]}>{v}</Text>
            </View>
          ))}
          {ev.description ? (
            <View style={[styles.divider, { paddingTop: spacing.md }]}>
              <Text style={[text.small, { color: colors.textMuted }]}>Description</Text>
              <Text style={[text.body, { color: colors.text, marginTop: 2 }]}>{ev.description}</Text>
            </View>
          ) : null}
        </Card>

        <Notice message={notice.message} tone={notice.tone} />

        {d.pendingIntent && d.owed > 0 ? (
          <Card style={styles.block}>
            <Text style={[text.bodyStrong, { color: colors.text }]}>Paid but not showing yet?</Text>
            <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>If you completed a payment and your balance has not changed, check it here. You will not be charged twice.</Text>
            <Button title="Check my payment" variant="soft" loading={checking} onPress={checkPending} style={{ marginTop: spacing.md, height: 46 }} />
          </Card>
        ) : null}

        <Text style={[text.h3, styles.heading]}>Payment history</Text>
        {d.payments.length === 0 ? (
          <Text style={[text.body, { color: colors.textMuted }]}>No payments recorded yet for this fee.</Text>
        ) : (
          d.payments.map(p => (
            <Card key={p.id} style={styles.pay}>
              <View style={styles.payIcon}>
                <Icon name="check" size={18} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, { color: colors.text }]}>{naira(p.amount)}</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{methodLabel(p.payment_method) + '  |  ' + shortDate(p.payment_date)}</Text>
                <Text style={[text.caption, { color: colors.textMuted }]}>{'Receipt: ' + (p.receipt_number || '-')}</Text>
              </View>
              <Button title="Receipt" variant="soft" onPress={() => openReceipt(p)} style={{ height: 40, paddingHorizontal: 14 }} />
            </Card>
          ))
        )}

        {d.owed > 0 ? (
          <View style={{ marginTop: spacing.xl }}>
            <View style={styles.toggle}>
              {[false, true].map(v => (
                <Pressable key={String(v)} onPress={() => setPart(v)} style={[styles.toggleBtn, part === v && styles.toggleOn]}>
                  <Text style={[text.bodyStrong, { color: part === v ? '#FFFFFF' : colors.textMuted }]}>{v ? 'Part payment' : 'Full amount'}</Text>
                </Pressable>
              ))}
            </View>
            {part ? (
              <View style={{ marginTop: spacing.md }}>
                <TextInput value={amount} onChangeText={t => setAmount(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="Enter amount to pay" placeholderTextColor="#9CA3AF" style={styles.input} returnKeyType="done" />
                <Text style={[text.small, { color: colors.textMuted, marginTop: 6 }]}>{'Enter any amount up to ' + naira(d.owed) + '. The rest stays as balance.'}</Text>
              </View>
            ) : null}
            <Button title={payAmount ? 'Pay ' + naira(payAmount) + ' now' : 'Enter an amount'} icon="lock" loading={busy} onPress={pay} style={{ marginTop: spacing.lg }} />
            <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>Pay securely online with card, transfer or USSD.</Text>
          </View>
        ) : (
          <Badge label="Fully paid. Thank you." tone="green" />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 60 },
  hero: { alignItems: 'center', paddingVertical: spacing.xl },
  heroIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  center: { textAlign: 'center' },
  bigAmount: { fontFamily: fonts.headingBold, fontSize: 34, lineHeight: 44, marginTop: spacing.md },
  block: { marginTop: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  heading: { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  pay: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, padding: spacing.md },
  payIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', backgroundColor: '#EDEEF0', borderRadius: radius.pill, padding: 4 },
  toggleBtn: { flex: 1, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: colors.primary },
  input: { height: 56, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 16, fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
});
