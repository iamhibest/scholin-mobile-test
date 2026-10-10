import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, RefreshControl, StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import Share from 'react-native-share';
import { useFocusEffect } from '@react-navigation/native';
import { Card, EmptyState, Input, Notice, OptionField, PressableScale, Screen, ShineButton, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { NIGERIAN_BANKS } from '../lib/banks';
import { supabase } from '../lib/supabase';
import { naira } from '../lib/format';
import { fetchReferralData, saveBank } from '../lib/staffTools';

function Stat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[text.caption, { color: colors.textMuted, textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

export default function ReferralScreen() {
  const [uid, setUid] = useState('');
  const [data, setData] = useState<any>(null);
  const [bankName, setBankName] = useState('');
  const [bankNo, setBankNo] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 1800, useNativeDriver: true }), Animated.timing(glow, { toValue: 0, duration: 1800, useNativeDriver: true })]));
    loop.start();
    return () => loop.stop();
  }, [glow]);

  const load = useCallback(async () => {
    try {
      const { data: s } = await supabase.auth.getSession();
      const id = s.session?.user?.id;
      if (!id) {
        return;
      }
      setUid(id);
      const d = await fetchReferralData(id);
      setData(d);
      setBankName(d.bank.name);
      setBankNo(d.bank.number);
      setBankHolder(d.bank.holder);
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
      setData({ code: null, bank: { name: '', number: '', holder: '' }, schools: [], pendingTotal: 0, payouts: [] });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const share = async () => {
    if (!data || !data.code) {
      return;
    }
    try {
      await Share.open({ message: 'Run your school smarter with Scholin. Use my referral code ' + data.code + ' when you register your school.', failOnCancel: false });
    } catch {}
  };

  const save = async () => {
    setNotice({ message: '', tone: 'success' });
    if (bankNo && !/^\d{10}$/.test(bankNo.trim())) {
      setNotice({ message: 'Account number should be 10 digits.', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      await saveBank(uid, { name: bankName, number: bankNo, holder: bankHolder });
      setNotice({ message: 'Bank details saved.', tone: 'success' });
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setSaving(false);
  };

  if (!data) {
    return (
      <Screen>
        <Skeleton height={190} radius={24} />
        <Skeleton height={90} radius={20} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  const subscribed = data.schools.filter((s: any) => s.is_subscribed).length;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Notice message={notice.message} tone={notice.tone} />

        <View style={styles.hero}>
          <Animated.View style={[styles.orb, { opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.2] }) }]} />
          <Text style={styles.kicker}>Your referral code</Text>
          <Text style={styles.code} selectable>{data.code || '------'}</Text>
          <Text style={styles.heroSub}>Press and hold the code to copy it, or share it with schools you know.</Text>
          <View style={styles.heroActions}>
            <PressableScale onPress={share} style={[styles.heroBtn, { backgroundColor: '#FFFFFF' }]}>
              <Text style={[styles.heroBtnText, { color: colors.primary }]}>Share my code</Text>
            </PressableScale>
          </View>
        </View>

        <View style={styles.stats}>
          <Stat label="Schools referred" value={String(data.schools.length)} tint={colors.primary} />
          <Stat label="Subscribed" value={String(subscribed)} tint={colors.success} />
          <Stat label="Balance" value={naira(data.pendingTotal)} tint={colors.accentDark} />
        </View>

        <Text style={[text.h3, styles.head]}>Referred schools</Text>
        {data.schools.length === 0 ? (
          <EmptyState icon="gift" title="No referrals yet" message="Share your code with schools you know. You will see them here once they register." />
        ) : (
          data.schools.map((s: any) => (
            <View key={s.id} style={styles.row}>
              <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={1}>{s.name}</Text>
              <View style={[styles.pill, { backgroundColor: !s.is_subscribed ? '#EEF1F6' : s.pending ? '#FFF1E0' : colors.successSoft }]}>
                <Text style={[styles.pillText, { color: !s.is_subscribed ? colors.textMuted : s.pending ? '#B45309' : colors.success }]}>{!s.is_subscribed ? 'Not subscribed yet' : s.pending ? 'Balance ' + naira(s.pending) : 'Subscribed'}</Text>
              </View>
            </View>
          ))
        )}

        <Text style={[text.h3, styles.head]}>Payments received</Text>
        {data.payouts.length === 0 ? (
          <Card>
            <Text style={[text.small, { color: colors.textMuted }]}>No payments received yet. Your balance updates as soon as a referred school subscribes.</Text>
          </Card>
        ) : (
          data.payouts.map((p: any) => (
            <View key={p.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, { color: colors.text }]}>Payment received</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{new Date(p.paid_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
              </View>
              <Text style={[text.bodyStrong, { color: colors.success }]}>{naira(Number(p.total_amount))}</Text>
            </View>
          ))
        )}

        <Text style={[text.h3, styles.head]}>Where to send your earnings</Text>
        <View style={styles.bank}>
          <OptionField label="Bank" value={bankName} options={[{ value: '', label: 'Select your bank' }].concat(NIGERIAN_BANKS.map(b => ({ value: b.name, label: b.name })))} onChange={setBankName} />
          <Input label="Account number" value={bankNo} onChangeText={v => setBankNo(v.replace(/[^0-9]/g, '').slice(0, 10))} keyboardType="number-pad" />
          <Input label="Account name" value={bankHolder} onChangeText={setBankHolder} autoCapitalize="words" />
          <ShineButton title="Save bank details" loading={saving} onPress={save} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  hero: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl, overflow: 'hidden', alignItems: 'center' },
  orb: { position: 'absolute', top: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: '#FFFFFF' },
  kicker: { color: 'rgba(255,255,255,0.85)', fontSize: 12, letterSpacing: 1.3, textTransform: 'uppercase', fontFamily: fonts.semibold },
  code: { color: '#FFFFFF', fontSize: 40, letterSpacing: 6, marginTop: spacing.sm, fontFamily: fonts.headingBold },
  heroSub: { color: 'rgba(255,255,255,0.88)', fontSize: 13, textAlign: 'center', marginTop: spacing.sm, fontFamily: fonts.body },
  heroActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, alignSelf: 'stretch' },
  heroBtn: { flex: 1, height: 44, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroBtnText: { color: '#FFFFFF', fontSize: 14.5, fontFamily: fonts.semibold },
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: '#EEF1F6' },
  statValue: { fontSize: 20, fontFamily: fonts.headingBold },
  head: { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: '#EEF1F6' },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { fontSize: 11.5, fontFamily: fonts.semibold },
  bank: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: '#EEF1F6' },
});
