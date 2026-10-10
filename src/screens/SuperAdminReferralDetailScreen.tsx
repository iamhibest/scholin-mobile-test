import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { Button, Card, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { confirmAction } from '../lib/confirm';
import { fetchReferrerDetail, naira, payOutReferrer } from '../lib/superAdmin';

export default function SuperAdminReferralDetailScreen() {
  const route = useRoute<any>();
  const referrerId: string = route.params.referrerId;
  const [d, setD] = useState<Awaited<ReturnType<typeof fetchReferrerDetail>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  const load = useCallback(async () => {
    try {
      setD(await fetchReferrerDetail(referrerId));
    } catch (e: any) {
      setMsg({ message: e.message || 'Could not load this referrer.', tone: 'error' });
    }
  }, [referrerId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const payOut = () => {
    if (!d) {
      return;
    }
    confirmAction('Mark as paid', 'Mark ' + naira(d.pendingTotal) + ' as paid to this referrer? This records a payout and clears their current balance to zero.', 'Mark as paid', async () => {
      setBusy(true);
      setMsg({ message: '', tone: 'success' });
      try {
        await payOutReferrer(referrerId);
        setMsg({ message: 'Payout recorded.', tone: 'success' });
        await load();
      } catch (e: any) {
        setMsg({ message: e.message, tone: 'error' });
      }
      setBusy(false);
    }, false);
  };

  if (!d) {
    return <Screen>{msg.message ? <Notice message={msg.message} tone={msg.tone} /> : <Skeleton height={200} radius={24} />}</Screen>;
  }
  const p = d.profile;
  const now = new Date();

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[text.h2, { color: colors.text }]}>{p ? p.full_name : 'Referrer'}</Text>
        <Text style={[text.small, { color: colors.textMuted }]}>{p ? (p.email || '') + (p.referral_code ? '. Code ' + p.referral_code : '') : ''}</Text>
        {p && p.bank_name ? (
          <Text style={[text.small, { color: colors.text, marginTop: spacing.sm }]}>{p.bank_name + ', ' + (p.bank_account_number || '') + ' (' + (p.bank_account_name || '') + ')'}</Text>
        ) : (
          <Text style={[text.small, { color: colors.danger, marginTop: spacing.sm }]}>No bank details added yet.</Text>
        )}

        <Notice message={msg.message} tone={msg.tone} />

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={[text.small, { color: colors.textMuted }]}>Current balance</Text>
            <Text style={[text.h3, { color: colors.accentDark }]}>{naira(d.pendingTotal)}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[text.small, { color: colors.textMuted }]}>Paid to date</Text>
            <Text style={[text.h3, { color: colors.success }]}>{naira(d.paidTotal)}</Text>
          </View>
        </View>
        {d.pendingTotal > 0 ? (
          <Button title={'Mark ' + naira(d.pendingTotal) + ' as paid'} loading={busy} onPress={payOut} />
        ) : (
          <Text style={[text.small, { color: colors.textMuted, textAlign: 'center' }]}>No pending balance. This referrer is fully paid up.</Text>
        )}

        <Text style={[text.h3, { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>Schools referred</Text>
        {d.referrals.length === 0 ? (
          <Card><Text style={[text.small, { color: colors.textMuted }]}>No referred schools yet.</Text></Card>
        ) : (
          d.referrals.map(r => {
            const st = d.bySchool[r.school_id] || { total: 0, pending: 0, name: r.schools ? r.schools.name : 'School' };
            const expired = new Date(r.referral_expires_at) < now;
            return (
              <Card key={r.id} style={styles.card}>
                <View style={styles.top}>
                  <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]}>{st.name}</Text>
                  <Text style={[styles.tag, { color: expired ? colors.danger : colors.success, borderColor: expired ? colors.danger : colors.success }]}>
                    {expired ? 'Window expired' : 'Window active'}
                  </Text>
                </View>
                <Text style={[text.small, { color: colors.textMuted, marginTop: 4 }]}>
                  {'Registered ' + new Date(r.registered_at).toLocaleDateString() + '. Commission window ends ' + new Date(r.referral_expires_at).toLocaleDateString() + '.'}
                </Text>
                <Text style={[text.small, { color: colors.text, marginTop: 4 }]}>
                  {naira(st.total) + ' total earned' + (st.pending > 0 ? '. ' + naira(st.pending) + ' pending.' : '.')}
                </Text>
              </Card>
            );
          })
        )}

        <Text style={[text.h3, { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md }]}>Payout history</Text>
        {d.payouts.length === 0 ? (
          <Card><Text style={[text.small, { color: colors.textMuted }]}>No payouts sent yet.</Text></Card>
        ) : (
          d.payouts.map(x => (
            <Card key={x.id} style={styles.card}>
              <View style={styles.top}>
                <Text style={[text.small, { color: colors.text, flex: 1 }]}>{new Date(x.paid_at).toLocaleString()}</Text>
                <Text style={[text.bodyStrong, { color: colors.text }]}>{naira(x.total_amount)}</Text>
              </View>
              {x.note ? <Text style={[text.small, { color: colors.textMuted, marginTop: 4 }]}>{x.note}</Text> : null}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  stats: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.lg },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 18, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: 4 },
  card: { marginBottom: spacing.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  tag: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
});
