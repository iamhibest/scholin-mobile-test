import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, RefreshControl, StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useFocusEffect } from '@react-navigation/native';
import { BottomSheet, Button, Card, EmptyState, Fab, Input, Notice, PressableScale, Screen, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { confirmAction } from '../lib/confirm';
import { naira } from '../lib/format';
import { supabase } from '../lib/supabase';
import { requeryPayment, verifyPayment } from '../lib/payments';
import { daysLeft, deleteVacancy, fetchMyVacancies, restartVacancyPayment, Vacancy } from '../lib/vacancies';

type Tone = { message: string; tone: 'error' | 'success' };

function LiveDot() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: colors.success, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) }] }} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
    </View>
  );
}

function Stat({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: tint }]}>{value}</Text>
      <Text style={[text.caption, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

export default function MyVacanciesScreen({ navigation }: any) {
  const [items, setItems] = useState<Vacancy[] | null>(null);
  const [userId, setUserId] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<Tone>({ message: '', tone: 'success' });
  const [refSheet, setRefSheet] = useState<Vacancy | null>(null);
  const [refText, setRefText] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) {
        setItems([]);
        return;
      }
      setUserId(uid);
      setItems(await fetchMyVacancies(uid));
    } catch (e: any) {
      setItems([]);
      setNotice({ message: e.message || 'Could not load your postings.', tone: 'error' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const payNow = async (v: Vacancy) => {
    setNotice({ message: '', tone: 'success' });
    setBusy(v.id);
    try {
      const c = await restartVacancyPayment(v.id);
      if (!c) {
        setNotice({ message: 'This payment was already confirmed.', tone: 'success' });
        await load();
      } else {
        navigation.navigate('PaymentCheckout', { kind: 'vacancy', url: c.url, reference: c.reference, paymentId: v.id, amountLabel: naira(Number(v.amount_charged)) });
      }
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const verify = async (v: Vacancy) => {
    setNotice({ message: '', tone: 'success' });
    setBusy(v.id);
    try {
      await requeryPayment('vacancy', v.id);
      setNotice({ message: 'Payment confirmed. Your vacancy is now live.', tone: 'success' });
      await load();
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const verifyRef = async () => {
    const ref = refText.trim();
    if (!ref || !refSheet) {
      return;
    }
    setBusy(refSheet.id);
    try {
      await verifyPayment('vacancy', ref, refSheet.id);
      setRefSheet(null);
      setRefText('');
      setNotice({ message: 'Payment confirmed. Your vacancy is now live.', tone: 'success' });
      await load();
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const remove = (v: Vacancy) =>
    confirmAction('Delete posting', 'This cannot be undone.', 'Delete', async () => {
      try {
        await deleteVacancy(v.id);
        await load();
      } catch (e: any) {
        setNotice({ message: e.message, tone: 'error' });
      }
    });

  if (items === null) {
    return (
      <Screen>
        <Skeleton height={80} radius={20} />
        <Skeleton height={150} radius={20} style={{ marginTop: spacing.lg }} />
        <Skeleton height={150} radius={20} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  const now = Date.now();
  const expired = (v: Vacancy) => new Date(v.expires_at).getTime() < now;
  const live = items.filter(v => !expired(v) && (v.payment_status === 'paid' || v.payment_status === 'free')).length;
  const pending = items.filter(v => !expired(v) && v.payment_status === 'pending').length;
  const ended = items.filter(expired).length;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Notice message={notice.message} tone={notice.tone} />
        {items.length > 0 ? (
          <View style={styles.stats}>
            <Stat label="Live" value={live} tint={colors.success} />
            <Stat label="Awaiting payment" value={pending} tint={colors.accentDark} />
            <Stat label="Ended" value={ended} tint={colors.textMuted} />
          </View>
        ) : null}

        {items.length === 0 ? <EmptyState icon="briefcase" title="No postings yet" message="Post your first vacancy to reach teachers across Scholin." /> : null}

        {items.map((v, i) => {
          const isExpired = expired(v);
          const isLive = !isExpired && (v.payment_status === 'paid' || v.payment_status === 'free');
          const isPending = !isExpired && v.payment_status === 'pending';
          const left = daysLeft(v);
          return (
            <Card key={v.id} style={{ marginBottom: spacing.md }}>
              <View style={styles.top}>
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={2}>{v.title}</Text>
                  <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>
                    {v.days_purchased + (v.days_purchased === 1 ? ' day' : ' days') + ' · ' + (Number(v.amount_charged) > 0 ? naira(Number(v.amount_charged)) : 'Free') + (!isExpired ? ' · ' + left + (left === 1 ? ' day left' : ' days left') : '')}
                  </Text>
                </View>
                <View style={[styles.status, { backgroundColor: isLive ? colors.successSoft : isPending ? '#FFF1E0' : '#EEF1F6' }]}>
                  {isLive ? <LiveDot /> : null}
                  <Text style={[styles.statusText, { color: isLive ? colors.success : isPending ? '#B45309' : colors.textMuted }]}>{isExpired ? 'Expired' : isPending ? 'Awaiting payment' : v.payment_status === 'free' ? 'Live, free' : 'Live'}</Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Button title="View" variant="soft" onPress={() => navigation.navigate('VacancyDetail', { id: v.id })} style={styles.action} />
                <Button title="Edit" variant="soft" onPress={() => navigation.navigate('PostVacancy', { editId: v.id })} style={styles.action} />
                {isPending ? <Button title={'Pay ' + naira(Number(v.amount_charged))} loading={busy === v.id} onPress={() => payNow(v)} style={styles.action} /> : null}
                {isPending && v.payment_reference ? <Button title="Verify" variant="soft" onPress={() => verify(v)} style={styles.action} /> : null}
                {isPending ? <Button title="Already paid" variant="soft" onPress={() => { setRefText(''); setRefSheet(v); }} style={styles.action} /> : null}
                <Button title="Delete" variant="danger" onPress={() => remove(v)} style={styles.action} />
              </View>
            </Card>
          );
        })}
      </ScrollView>
      <Fab label="Post a vacancy" icon="plus" onPress={() => navigation.navigate('PostVacancy', {})} />

      <BottomSheet visible={!!refSheet} onClose={() => setRefSheet(null)} title="Check a payment reference">
        <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>Paste the reference from your payment receipt email, for example vac_xxxxxxxx_123456789.</Text>
        <Input label="Payment reference" value={refText} onChangeText={setRefText} autoCapitalize="none" autoCorrect={false} />
        <Button title="Verify payment" loading={!!refSheet && busy === refSheet.id} disabled={!refText.trim()} onPress={verifyRef} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 120 },
  stats: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: '#EEF1F6' },
  statValue: { fontSize: 24, fontFamily: fonts.headingBold },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  statusText: { fontSize: 11.5, fontFamily: fonts.semibold },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  action: { flexGrow: 1, flexBasis: '46%', minWidth: 0, height: 42, paddingHorizontal: 10 },
});
