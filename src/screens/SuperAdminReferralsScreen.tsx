import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Button, Card, Input, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { confirmAction } from '../lib/confirm';
import { fetchReferrers, fetchSettings, naira, payOutReferrer, saveSettings } from '../lib/superAdmin';

type Msg = { message: string; tone: 'error' | 'success' };
const none: Msg = { message: '', tone: 'success' };

export default function SuperAdminReferralsScreen() {
  const navigation = useNavigation<any>();
  const [rate, setRate] = useState('');
  const [rateMsg, setRateMsg] = useState<Msg>(none);
  const [listMsg, setListMsg] = useState<Msg>(none);
  const [referrers, setReferrers] = useState<any[] | null>(null);
  const [busy, setBusy] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await fetchSettings();
      setRate(String(s && s.referral_commission_per_month ? s.referral_commission_per_month : 0));
    } catch {
      setRateMsg({ message: 'Could not load the current rate.', tone: 'error' });
    }
    try {
      setReferrers(await fetchReferrers());
    } catch (e: any) {
      setReferrers(prev => prev || []);
      setListMsg({ message: e.message, tone: 'error' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const saveRate = async () => {
    setRateMsg(none);
    const v = parseFloat(rate);
    if (isNaN(v) || v < 0) {
      setRateMsg({ message: 'Enter a valid amount.', tone: 'error' });
      return;
    }
    setBusy('rate');
    try {
      await saveSettings({ referral_commission_per_month: v });
      setRateMsg({ message: 'Commission rate saved.', tone: 'success' });
    } catch (e: any) {
      setRateMsg({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const payOut = (g: any) => {
    confirmAction(
      'Mark as paid',
      'Mark ' + naira(g.pendingTotal) + ' as paid to ' + g.profile.full_name + '? This records a payout and clears their current balance to zero. Anything they earn after this is tracked separately.',
      'Mark as paid',
      async () => {
        setBusy(g.id);
        setListMsg(none);
        try {
          await payOutReferrer(g.id);
          setListMsg({ message: 'Payout recorded.', tone: 'success' });
          await load();
        } catch (e: any) {
          setListMsg({ message: e.message, tone: 'error' });
        }
        setBusy('');
      },
      false,
    );
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text }]}>Commission per month</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>What a referrer earns for each month a referred school pays for.</Text>
          <Notice message={rateMsg.message} tone={rateMsg.tone} />
          <Input label="Amount (₦) per month" value={rate} onChangeText={setRate} keyboardType="decimal-pad" />
          <Button title="Save commission rate" loading={busy === 'rate'} onPress={saveRate} />
        </Card>

        <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Referrers</Text>
        <Notice message={listMsg.message} tone={listMsg.tone} />
        {referrers === null ? (
          <Skeleton height={160} radius={20} />
        ) : referrers.length === 0 ? (
          <Card>
            <Text style={[text.bodyStrong, { color: colors.text }]}>No referral commissions yet</Text>
            <Text style={[text.small, { color: colors.textMuted, marginTop: 4 }]}>These appear once a referred school subscribes.</Text>
          </Card>
        ) : (
          referrers.map(g => (
            <Card key={g.id} style={styles.card}>
              <View style={styles.top}>
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyStrong, { color: colors.text }]}>{g.profile.full_name}</Text>
                  <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>{g.profile.email || ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[text.h3, { color: colors.accentDark }]}>{naira(g.pendingTotal)}</Text>
                  <Text style={[text.caption, { color: colors.textMuted }]}>{'current balance. ' + naira(g.paidTotal) + ' paid'}</Text>
                </View>
              </View>
              {g.profile.bank_name ? (
                <Text style={[text.small, { color: colors.text, marginTop: spacing.md }]}>
                  {g.profile.bank_name + ', ' + (g.profile.bank_account_number || '') + ' (' + (g.profile.bank_account_name || '') + ')'}
                </Text>
              ) : (
                <Text style={[text.small, { color: colors.danger, marginTop: spacing.md }]}>No bank details added yet.</Text>
              )}
              {g.pending.length > 0 ? (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={[text.small, { color: colors.textMuted, marginBottom: 4 }]}>{g.pending.length + ' pending commission' + (g.pending.length === 1 ? '' : 's')}</Text>
                  {g.pending.map((c: any) => (
                    <View key={c.id} style={styles.row}>
                      <Text style={[text.small, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                        {(c.schools ? c.schools.name : 'School') + ', ' + new Date(c.created_at).toLocaleDateString()}
                      </Text>
                      <Text style={[text.small, { color: colors.text }]}>{naira(c.commission_amount)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.md }]}>No pending commissions. Balance is up to date.</Text>
              )}
              <View style={styles.actions}>
                {g.pending.length > 0 ? <Button title={'Mark ' + naira(g.pendingTotal) + ' as paid'} loading={busy === g.id} onPress={() => payOut(g)} /> : null}
                <Button title="View full details" variant="outline" onPress={() => navigation.navigate('SuperAdminReferralDetail', { referrerId: g.id, name: g.profile.full_name })} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  block: { marginBottom: spacing.xl },
  card: { marginBottom: spacing.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, paddingVertical: 3 },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
