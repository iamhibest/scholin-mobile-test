import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, FilterChips, Icon, Notice, Screen, SearchBar, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { fetchFinance, fetchSchoolOnlinePayments, naira, syncSettlements } from '../lib/superAdmin';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'settled', label: 'Settled' },
];

function Box({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.box}>
      <Text style={[text.small, { color: color || colors.textMuted }]}>{label}</Text>
      <Text style={[text.h3, { color: color || colors.text }]}>{naira(value)}</Text>
    </View>
  );
}

export default function SuperAdminFinanceScreen({ navigation }: any) {
  const [figures, setFigures] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState('');
  const [details, setDetails] = useState<Record<string, any[] | null>>({});
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  const load = useCallback(async () => {
    try {
      setFigures(await fetchFinance());
    } catch (e: any) {
      setFigures(prev => prev || []);
      setMsg({ message: e.message, tone: 'error' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggle = async (id: string) => {
    if (open === id) {
      setOpen('');
      return;
    }
    setOpen(id);
    setDetails(d => ({ ...d, [id]: null }));
    const rows = await fetchSchoolOnlinePayments(id);
    setDetails(d => ({ ...d, [id]: rows }));
  };

  const sync = async () => {
    setMsg({ message: '', tone: 'success' });
    setSyncing(true);
    try {
      const r = await syncSettlements();
      setMsg({ message: 'Synced ' + r.settlements_synced + ' settlement(s), matched ' + r.payments_matched + ' payment(s) as paid out.', tone: 'success' });
      setDetails({});
      await load();
    } catch (e: any) {
      setMsg({ message: e.message, tone: 'error' });
    }
    setSyncing(false);
  };

  const all = figures || [];
  const t = all.reduce((a, s) => ({
    collected: a.collected + s.collected, commission: a.commission + s.commission, fees: a.fees + s.paystackFees,
    net: a.net + s.net, settled: a.settled + s.settled, pending: a.pending + s.pending,
  }), { collected: 0, commission: 0, fees: 0, net: 0, settled: 0, pending: 0 });
  const q = query.trim().toLowerCase();
  const rows = all.filter(s => {
    if (q && !(s.name || '').toLowerCase().includes(q)) {
      return false;
    }
    if (filter === 'pending') {
      return s.pending > 0;
    }
    if (filter === 'settled') {
      return s.count > 0 && s.pending === 0;
    }
    return true;
  });

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Button title="Sync settlements" variant="outline" loading={syncing} onPress={sync} />
        <Notice message={msg.message} tone={msg.tone} />
        {figures === null ? (
          <Skeleton height={200} radius={22} />
        ) : (
          <View style={styles.grid}>
            <Box label="Total collected" value={t.collected} />
            <Box label="Your commission" value={t.commission} />
            <Box label="Paystack fees" value={t.fees} />
            <Box label="Net owed to schools" value={t.net} />
            <Box label="Settled to schools" value={t.settled} color={colors.success} />
            <Box label="Pending settlement" value={t.pending} color={colors.accentDark} />
          </View>
        )}
        <SearchBar value={query} onChange={setQuery} placeholder="Search schools" />
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        {figures !== null && rows.length === 0 ? (
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl }]}>No schools match this search or filter.</Text>
        ) : null}
        {rows.map(s => (
          <Card key={s.id} style={styles.card}>
            <Pressable onPress={() => toggle(s.id)} style={styles.head}>
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, { color: colors.text }]}>{s.name}</Text>
                <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>
                  {'Collected ' + naira(s.collected) + '. Commission ' + naira(s.commission) + '. Paystack fee ' + naira(s.paystackFees) + '.'}
                </Text>
                <Text style={[text.small, { marginTop: 2 }]}>
                  <Text style={{ color: colors.success }}>{'Settled ' + naira(s.settled)}</Text>
                  <Text style={{ color: colors.textMuted }}>{'   '}</Text>
                  <Text style={{ color: colors.accentDark }}>{'Pending ' + naira(s.pending)}</Text>
                </Text>
              </View>
              <Icon name="chevronDown" size={18} color={colors.textMuted} />
            </Pressable>
            {open === s.id ? (
              <View style={styles.detail}>
                <Button title="Open payment history and receipts" variant="soft" onPress={() => navigation.navigate('PaymentHistory', { schoolId: s.id })} />
                {details[s.id] === null || details[s.id] === undefined ? (
                  <Text style={[text.small, { color: colors.textMuted }]}>Loading payments...</Text>
                ) : (details[s.id] as any[]).length === 0 ? (
                  <Text style={[text.small, { color: colors.textMuted }]}>No online payments yet.</Text>
                ) : (
                  (details[s.id] as any[]).map(p => (
                    <View key={p.id} style={styles.pay}>
                      <Text style={[text.small, { color: colors.text }]}>
                        {(p.events && p.events.name ? p.events.name : 'Fee') + ', ' + new Date(p.payment_date).toLocaleDateString() + ', ' + p.receipt_number}
                      </Text>
                      <Text style={[text.small, { color: p.settled_at ? colors.success : colors.accentDark }]}>
                        {naira(p.amount) + ': ' + (p.settled_at ? 'Settled ' + new Date(p.settled_at).toLocaleDateString() : 'Pending')}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  box: { width: '47.5%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: 18, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: 4 },
  card: { marginBottom: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  detail: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  pay: { paddingVertical: spacing.sm, gap: 2 },
});
