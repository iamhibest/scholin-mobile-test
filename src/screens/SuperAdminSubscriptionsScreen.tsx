import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Button, Card, FilterChips, Input, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { confirmAction } from '../lib/confirm';
import { getSchoolAccessStatus } from '../lib/dashboard';
import { fetchSchoolsForSubscriptions, naira, updateSchoolRow } from '../lib/superAdmin';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'subscribed', label: 'Active' },
  { key: 'trial', label: 'On trial' },
  { key: 'expired', label: 'Expired' },
  { key: 'cancelled', label: 'Cancelled' },
];
const LABEL: Record<string, string> = { subscribed: 'Active subscription', trial: 'On trial', expired: 'Expired', cancelled: 'Cancelled' };

function classify(s: any): string {
  if (s.subscription_cancelled_at) {
    return 'cancelled';
  }
  return (getSchoolAccessStatus(s) as any).reason;
}

export default function SuperAdminSubscriptionsScreen() {
  const navigation = useNavigation<any>();
  const [schools, setSchools] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [cancelling, setCancelling] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  const load = useCallback(async () => {
    try {
      setSchools(await fetchSchoolsForSubscriptions());
    } catch (e: any) {
      setSchools(prev => prev || []);
      setMsg({ message: e.message, tone: 'error' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const cancel = (s: any) => {
    confirmAction('Cancel subscription', s.name + ' loses paid access immediately.', 'Cancel subscription', async () => {
      setBusy(true);
      try {
        await updateSchoolRow(s.id, { subscription_cancelled_at: new Date().toISOString(), subscription_cancelled_reason: reason.trim() || null });
        setMsg({ message: 'Subscription cancelled. Access has been revoked immediately.', tone: 'success' });
        setCancelling('');
        setReason('');
        await load();
      } catch (e: any) {
        setMsg({ message: e.message, tone: 'error' });
      }
      setBusy(false);
    });
  };

  const rows = (schools || []).filter(s => filter === 'all' || classify(s) === filter);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        <Notice message={msg.message} tone={msg.tone} />
        {schools === null ? (
          <Skeleton height={160} radius={20} />
        ) : rows.length === 0 ? (
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl }]}>No schools match this filter.</Text>
        ) : (
          rows.map(s => {
            const state = classify(s);
            const color = state === 'subscribed' ? colors.success : state === 'trial' ? colors.accentDark : colors.danger;
            const ends =
              state === 'subscribed' ? new Date(s.subscription_ends_at).toLocaleDateString()
              : state === 'trial' ? new Date(s.trial_ends_at).toLocaleDateString() + ' (trial)'
              : 'None';
            return (
              <Card key={s.id} style={styles.card}>
                <View style={styles.top}>
                  <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={2}>{s.name}</Text>
                  <Text style={[styles.tag, { color, borderColor: color }]}>{LABEL[state]}</Text>
                </View>
                <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.xs }]}>
                  {'Ends: ' + ends + (s.subscription_amount ? '. Last paid ' + naira(s.subscription_amount) + (s.subscription_months ? ' for ' + s.subscription_months + ' month(s)' : '') : '')}
                </Text>
                {s.subscription_cancelled_at ? (
                  <Text style={[text.small, { color: colors.danger, marginTop: spacing.xs }]}>
                    {'Cancelled ' + new Date(s.subscription_cancelled_at).toLocaleDateString() + (s.subscription_cancelled_reason ? ': ' + s.subscription_cancelled_reason : '')}
                  </Text>
                ) : null}
                <View style={styles.actions}>
                  <Button title="Open school" variant="outline" onPress={() => navigation.navigate('SuperAdminSchoolView', { schoolId: s.id, name: s.name })} />
                  {state === 'subscribed' ? <Button title="Cancel" variant="soft" onPress={() => setCancelling(cancelling === s.id ? '' : s.id)} /> : null}
                </View>
                {cancelling === s.id ? (
                  <View style={{ marginTop: spacing.md }}>
                    <Input label="Reason (the school sees this)" value={reason} onChangeText={setReason} />
                    <Button title="Cancel this subscription" variant="danger" loading={busy} onPress={() => cancel(s)} />
                  </View>
                ) : null}
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xxxl },
  card: { marginBottom: spacing.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  tag: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
