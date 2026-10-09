import React, { useCallback, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Badge, Button, Card, EmptyState, FilterChips, Icon, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { naira } from '../lib/format';
import { checkPaystackPayouts, fetchPayoutHistory, maskAccount, PayoutHistory } from '../lib/payoutHistory';
import { buildPayoutReceiptHtml } from '../lib/payoutReceiptDoc';
import { canManageFees } from './EventsScreen';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'paid', label: 'Paid' },
];

function shortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export default function PaymentHistoryScreen({ navigation, route }: any) {
  const { ctx, loading: ctxLoading } = useStaff();
  // A super admin opens a school's history by passing its id; everyone else uses their own school.
  const schoolId: string | undefined = (route && route.params && route.params.schoolId) || (ctx ? ctx.schoolId : undefined);
  const viaSuperAdmin = !!(route && route.params && route.params.schoolId);
  const [history, setHistory] = useState<PayoutHistory | null>(null);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'error' });
  const autoChecked = useRef(false);

  const load = useCallback(async () => {
    if (!schoolId) {
      return;
    }
    try {
      const h = await fetchPayoutHistory(schoolId);
      setHistory(h);
      return h;
    } catch (e: any) {
      setHistory(prev => prev || { school_name: '', bank_name: null, account_name: null, account_last4: '', payments: [] });
      setMsg({ message: e.message, tone: 'error' });
    }
  }, [schoolId]);

  // Asks Paystack if anything has been paid out, then reloads. Quiet when it is not available.
  const check = useCallback(async (manual: boolean) => {
    if (!schoolId) {
      return;
    }
    setChecking(true);
    try {
      const r = await checkPaystackPayouts(schoolId);
      if (manual) {
        setMsg({ message: r.payments_matched > 0 ? r.payments_matched + ' payment(s) are now marked as paid to your account.' : 'Checked Paystack. Nothing new has been paid out yet.', tone: 'success' });
      }
      await load();
    } catch (e: any) {
      if (manual) {
        setMsg({ message: e.message || 'Could not check Paystack right now.', tone: 'error' });
      }
    }
    setChecking(false);
  }, [schoolId, load]);

  useFocusEffect(
    useCallback(() => {
      load().then(h => {
        if (h && !autoChecked.current && h.payments.some(p => !p.settled_at)) {
          autoChecked.current = true;
          check(false);
        }
      });
    }, [load, check]),
  );

  if (ctxLoading || (schoolId && history === null)) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={110} radius={20} />
          <Skeleton height={80} radius={20} />
          <Skeleton height={80} radius={20} />
        </View>
      </Screen>
    );
  }

  if (!schoolId || (!viaSuperAdmin && !canManageFees(ctx))) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Not available" message="Payment history is for the school owner and teacher admins who can manage events and fees." />
      </Screen>
    );
  }

  const h = history as PayoutHistory;
  const all = h.payments || [];
  const paidTotal = all.filter(p => p.settled_at).reduce((s, p) => s + Number(p.net_amount_to_school || 0), 0);
  const pendingTotal = all.filter(p => !p.settled_at).reduce((s, p) => s + Number(p.net_amount_to_school || 0), 0);
  const list = filter === 'all' ? all : all.filter(p => (filter === 'paid' ? !!p.settled_at : !p.settled_at));
  const account = h.account_last4 ? [h.bank_name, maskAccount(h.account_last4), h.account_name].filter(Boolean).join(' · ') : '';

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Notice message={msg.message} tone={msg.tone} />
        <View style={styles.summary}>
          <View style={[styles.box, { borderColor: '#BBF7D0' }]}>
            <Text style={[text.small, { color: colors.success }]}>Paid to your account</Text>
            <Text style={[text.h3, { color: colors.success }]}>{naira(paidTotal)}</Text>
          </View>
          <View style={[styles.box, { borderColor: '#FDE68A' }]}>
            <Text style={[text.small, { color: colors.accentDark }]}>Pending from Paystack</Text>
            <Text style={[text.h3, { color: colors.accentDark }]}>{naira(pendingTotal)}</Text>
          </View>
        </View>
        {account ? (
          <View style={styles.account}>
            <Icon name="bank" size={18} color={colors.primary} />
            <Text style={[text.small, { color: colors.text, flex: 1 }]}>{'Paystack pays to: ' + account}</Text>
          </View>
        ) : null}
        <Button title="Check Paystack for payouts" variant="outline" loading={checking} onPress={() => check(true)} />
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        {list.length === 0 ? (
          <EmptyState
            icon="receipt"
            title={all.length === 0 ? 'No online payments yet' : 'Nothing here'}
            message={all.length === 0 ? 'When a parent pays a fee online it will show here, then change to Paid once Paystack pays it into your account.' : 'No payments match this filter.'}
          />
        ) : (
          list.map(p => {
            const paid = !!p.settled_at;
            return (
              <Pressable key={p.id} onPress={() => navigation.navigate('Receipt', { html: buildPayoutReceiptHtml(h, p), fileName: 'Payout_' + String(p.receipt_number || p.id) })}>
                <Card style={{ marginBottom: spacing.md }}>
                  <View style={styles.top}>
                    <View style={{ flex: 1 }}>
                      <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={2}>{(p.event_name || 'School fee') + ' · ' + (p.student_name || '')}</Text>
                      <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>{'Paid by ' + p.payer_name + ' on ' + shortDate(p.payment_date)}</Text>
                    </View>
                    <Badge label={paid ? 'Paid' : 'Pending'} tone={paid ? 'green' : 'orange'} />
                  </View>
                  <View style={styles.bottom}>
                    <Text style={[text.bodyStrong, { color: colors.text }]}>{naira(Number(p.net_amount_to_school || 0))}</Text>
                    <Text style={[text.small, { color: paid ? colors.success : colors.accentDark }]}>
                      {paid ? 'Paid to your account ' + shortDate(p.settled_at as string) : 'Waiting for Paystack'}
                    </Text>
                  </View>
                  <Text style={[text.caption, { color: colors.textMuted, marginTop: 4 }]}>{'Parent paid ' + naira(Number(p.amount)) + ' · tap for receipt'}</Text>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  summary: { flexDirection: 'row', gap: spacing.md },
  box: { flex: 1, backgroundColor: colors.surface, borderRadius: 18, padding: spacing.lg, borderWidth: 1, gap: 4 },
  account: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: 14, padding: spacing.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
});
