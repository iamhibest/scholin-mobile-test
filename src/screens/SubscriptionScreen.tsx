import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BottomSheet, Badge, Button, Card, EmptyState, Icon, Input, Notice, Screen, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { confirmAction } from '../lib/confirm';
import { getSchoolAccessStatus } from '../lib/dashboard';
import { naira, shortDate } from '../lib/format';
import { requeryPayment, verifyPayment } from '../lib/payments';
import { calculatePrice, deletePending, fetchPending, fetchPricing, fetchSchoolFresh, PRESET_MONTHS, restartSubscription, startSubscription, Tier } from '../lib/subscription';

type Tone = { message: string; tone: 'error' | 'success' };

export default function SubscriptionScreen({ navigation }: any) {
  const { ctx, loading: ctxLoading } = useStaff();
  const [school, setSchool] = useState<any>(null);
  const [pricing, setPricing] = useState<{ pricePerMonth: number; tiers: Tier[] } | null>(null);
  const [pending, setPending] = useState<any[]>([]);
  const [months, setMonths] = useState(4);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<Tone>({ message: '', tone: 'success' });
  const [refSheet, setRefSheet] = useState<any>(null);
  const [refText, setRefText] = useState('');

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      const [s, p, list] = await Promise.all([fetchSchoolFresh(ctx.schoolId), fetchPricing(), fetchPending(ctx.schoolId)]);
      setSchool(s);
      setPricing(p);
      setPending(list);
    } catch (e: any) {
      setNotice({ message: e.message || 'Could not load your subscription.', tone: 'error' });
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (ctxLoading || (ctx && (!school || !pricing) && !notice.message)) {
    return (
      <Screen>
        <Skeleton height={96} radius={20} />
        <Skeleton height={260} radius={20} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (!ctx || !ctx.isAdmin) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Admins only" message="Only the school owner or a teacher admin can manage the subscription." />
      </Screen>
    );
  }

  if (!school || !pricing) {
    return (
      <Screen>
        <Notice message={notice.message} tone="error" />
        <Button title="Try again" variant="soft" onPress={load} />
      </Screen>
    );
  }

  const status = getSchoolAccessStatus(school);
  const chosen = custom.trim() ? Math.max(1, parseInt(custom, 10) || 1) : months;
  const price = calculatePrice(chosen, pricing.pricePerMonth, pricing.tiers);

  const openCheckout = (c: { url: string; reference: string; paymentId: string; amount?: number }) => {
    navigation.navigate('PaymentCheckout', { kind: 'subscription', url: c.url, reference: c.reference, paymentId: c.paymentId, amountLabel: c.amount ? naira(c.amount) : undefined });
  };

  const pay = async () => {
    setNotice({ message: '', tone: 'success' });
    setBusy('new');
    try {
      openCheckout(await startSubscription(ctx.schoolId, chosen));
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy('');
    load();
  };

  const payPending = async (p: any) => {
    setNotice({ message: '', tone: 'success' });
    setBusy(p.id);
    try {
      const c = await restartSubscription(p.id);
      if (!c) {
        setNotice({ message: 'This payment was already confirmed.', tone: 'success' });
        await load();
      } else {
        openCheckout({ ...c, amount: Number(p.amount_charged) });
      }
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const verifyPending = async (p: any) => {
    setNotice({ message: '', tone: 'success' });
    setBusy(p.id);
    try {
      await requeryPayment('subscription', p.id);
      setNotice({ message: 'Payment confirmed. Your subscription is now active.', tone: 'success' });
      await load();
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const verifyReference = async () => {
    const ref = refText.trim();
    if (!ref || !refSheet) {
      return;
    }
    setBusy(refSheet.id);
    try {
      await verifyPayment('subscription', ref, refSheet.id);
      setRefSheet(null);
      setRefText('');
      setNotice({ message: 'Payment confirmed. Your subscription is now active.', tone: 'success' });
      await load();
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const removePending = (p: any) =>
    confirmAction('Delete pending payment', 'This cannot be undone.', 'Delete', async () => {
      try {
        await deletePending(p.id);
        await load();
      } catch (e: any) {
        setNotice({ message: e.message, tone: 'error' });
      }
    });

  let head = { title: 'Access expired', body: 'Clock In and Out, School Portal and the admin tools are locked. Subscribe below to restore access immediately.', bg: colors.dangerSoft, fg: colors.danger, icon: 'info' as const };
  if (status.reason === 'cancelled') {
    head = { title: 'Subscription cancelled', body: school.subscription_cancelled_reason || 'Cancelled by Scholin support. Contact support if this seems wrong, or start a new subscription below.', bg: colors.dangerSoft, fg: colors.danger, icon: 'info' };
  } else if (status.reason === 'subscribed') {
    head = { title: 'Active subscription', body: 'Renews or extends before ' + shortDate(school.subscription_ends_at), bg: colors.successSoft, fg: colors.success, icon: 'check' as any };
  } else if (status.reason === 'trial') {
    const left = Math.max(0, Math.ceil((new Date(school.trial_ends_at).getTime() - Date.now()) / 86400000));
    head = { title: 'Free trial, ' + left + (left === 1 ? ' day left' : ' days left'), body: 'Ends ' + shortDate(school.trial_ends_at) + '. Subscribe any time and nothing is lost.', bg: colors.accentSoft, fg: colors.accentDark, icon: 'clock' as any };
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Notice message={notice.message} tone={notice.tone} />

      <View style={[styles.status, { backgroundColor: head.bg }]}>
        <View style={[styles.statusIcon, { backgroundColor: head.fg }]}>
          <Icon name={head.icon} size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.bodyStrong, { color: head.fg }]}>{head.title}</Text>
          <Text style={[text.small, { color: colors.text, marginTop: 2 }]}>{head.body}</Text>
        </View>
      </View>

      {pending.length > 0 ? (
        <View style={{ marginTop: spacing.xl }}>
          <Text style={[text.bodyStrong, { color: colors.text, marginBottom: spacing.sm }]}>Pending payments</Text>
          {pending.map(p => (
            <Card key={p.id} style={{ marginBottom: spacing.md }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyStrong, { color: colors.text }]}>{p.months + (p.months === 1 ? ' month' : ' months')}</Text>
                  <Text style={[text.small, { color: colors.textMuted }]}>{naira(Number(p.amount_charged)) + ' started ' + shortDate(p.created_at)}</Text>
                </View>
                <Badge label="Pending" tone="orange" />
              </View>
              <View style={styles.actions}>
                <Button title="Pay now" loading={busy === p.id} onPress={() => payPending(p)} style={styles.action} />
                {p.payment_reference ? <Button title="Verify" variant="soft" onPress={() => verifyPending(p)} style={styles.action} /> : null}
                <Button title="Already paid" variant="soft" onPress={() => { setRefText(''); setRefSheet(p); }} style={styles.action} />
                <Button title="Delete" variant="danger" onPress={() => removePending(p)} style={styles.action} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}

      <Text style={[text.bodyStrong, { color: colors.text, marginTop: spacing.xl }]}>Choose your plan</Text>
      <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>Pick a duration that fits your school.</Text>
      {PRESET_MONTHS.map((m, i) => {
        const on = !custom.trim() && months === m;
        const p = calculatePrice(m, pricing.pricePerMonth, pricing.tiers);
        return (
          <Pressable key={m} onPress={() => { setCustom(''); setMonths(m); }} style={[styles.plan, on && styles.planOn]}>
            <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.dot} /> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={[text.bodyStrong, { color: colors.text }]}>{(i + 1) + (i === 0 ? ' term' : ' terms')}</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>{m + ' months'}</Text>
            </View>
            <Text style={[text.bodyStrong, { color: colors.primary }]}>{naira(p.total)}</Text>
          </Pressable>
        );
      })}
      <Input label="Or enter a custom number of months" value={custom} onChangeText={v => setCustom(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" placeholder="For example 6" />

      <Card>
        <View style={styles.row}>
          <Text style={[text.body, { color: colors.textMuted, flex: 1 }]}>{chosen + (chosen === 1 ? ' month' : ' months') + ' at ' + naira(pricing.pricePerMonth)}</Text>
          <Text style={[text.bodyStrong, { color: colors.text }]}>{naira(price.base)}</Text>
        </View>
        {price.percent > 0 ? (
          <View style={[styles.row, { marginTop: spacing.sm }]}>
            <Text style={[text.body, { color: colors.success, flex: 1 }]}>{'Discount ' + price.percent + ' percent'}</Text>
            <Text style={[text.bodyStrong, { color: colors.success }]}>{'Less ' + naira(price.discount)}</Text>
          </View>
        ) : null}
      </Card>
      <Button title={price.total > 0 ? 'Subscribe and pay ' + naira(price.total) : 'Subscribe'} loading={busy === 'new'} onPress={pay} style={{ marginTop: spacing.lg }} />
      <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.md }]}>The final amount is confirmed by the server before you pay.</Text>

      </ScrollView>

      <BottomSheet visible={!!refSheet} onClose={() => setRefSheet(null)} title="Check a payment reference">
        <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>Paste the reference from your payment receipt email, for example sub_xxxxxxxx_123456789.</Text>
        <Input label="Payment reference" value={refText} onChangeText={setRefText} autoCapitalize="none" autoCorrect={false} />
        <Button title="Verify payment" loading={!!refSheet && busy === refSheet.id} disabled={!refText.trim()} onPress={verifyReference} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  status: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, alignItems: 'center' },
  statusIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  action: { flexGrow: 1, flexBasis: '46%', minWidth: 0, height: 42, paddingHorizontal: 10 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.sm },
  planOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
