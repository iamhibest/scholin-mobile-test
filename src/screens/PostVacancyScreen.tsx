import React, { useCallback, useEffect, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, Input, Notice, PressableScale, Screen, ShineButton, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { naira } from '../lib/format';
import { fetchVacancy, fetchVacancyFlags, fetchVacancyPricing, normalizeLink, postVacancy, updateVacancy, vacancyPrice } from '../lib/vacancies';

const QUICK_DAYS = [7, 14, 30, 60];

export default function PostVacancyScreen({ navigation, route }: any) {
  const editId: string | undefined = route.params && route.params.editId;
  const { ctx, loading: ctxLoading } = useStaff();
  const [pricing, setPricing] = useState<{ pricePerDay: number; tiers: { min_days: number; discount_percent: number }[] } | null>(null);
  const [flags, setFlags] = useState({ pageEnabled: true, postingEnabled: true });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [postingType, setPostingType] = useState<'school' | 'personal'>('school');
  const [days, setDays] = useState('14');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(!editId);
  const total = useState(() => new Animated.Value(0))[0];

  const load = useCallback(async () => {
    try {
      const [p, f] = await Promise.all([fetchVacancyPricing(), fetchVacancyFlags()]);
      setPricing(p);
      setFlags(f);
      if (editId) {
        const v = await fetchVacancy(editId);
        if (v) {
          setTitle(v.title);
          setDescription(v.description);
          setLink(v.apply_link || '');
          setPostingType(v.posting_type === 'personal' ? 'personal' : 'school');
          setDays(String(v.days_purchased));
        }
        setLoaded(true);
      }
    } catch (e: any) {
      setError(e.message || 'Could not load pricing.');
      setLoaded(true);
    }
  }, [editId]);

  useEffect(() => {
    load();
  }, [load]);

  const dayCount = parseInt(days, 10) || 0;
  const price = pricing ? vacancyPrice(dayCount, pricing.pricePerDay, pricing.tiers) : { base: 0, percent: 0, discount: 0, total: 0 };

  useEffect(() => {
    Animated.sequence([Animated.spring(total, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 10 }), Animated.spring(total, { toValue: 0, useNativeDriver: true, speed: 20, bounciness: 8 })]).start();
  }, [price.total, total]);

  if (ctxLoading || !pricing || !loaded) {
    return (
      <Screen>
        <Skeleton height={60} radius={16} />
        <Skeleton height={220} radius={20} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (!ctx) {
    return (
      <Screen>
        <EmptyState icon="briefcase" title="Join a school first" message="Vacancies are posted on behalf of a school. Join or register a school to post." />
      </Screen>
    );
  }

  if (!flags.pageEnabled || (!flags.postingEnabled && !editId)) {
    return (
      <Screen>
        <EmptyState icon="briefcase" title="Posting unavailable" message="Posting vacancies is switched off for now. Please check back later." />
      </Screen>
    );
  }

  const submit = async () => {
    setError('');
    const t = title.trim();
    const d = description.trim();
    if (!t || !d) {
      setError('Title and description are required.');
      return;
    }
    const normalized = normalizeLink(link);
    if (normalized === 'invalid') {
      setError('Application link should start with https:// or www.');
      return;
    }
    setBusy(true);
    try {
      if (editId) {
        await updateVacancy(editId, { title: t, description: d, applyLink: normalized, postingType });
        navigation.goBack();
        return;
      }
      if (dayCount < 1) {
        setError('Please enter a valid number of days.');
        setBusy(false);
        return;
      }
      const result = await postVacancy({ title: t, description: d, applyLink: normalized, days: dayCount, postingType });
      if (result.free) {
        navigation.replace('MyVacancies');
        return;
      }
      navigation.replace('MyVacancies');
      navigation.navigate('PaymentCheckout', { kind: 'vacancy', url: result.checkout.url, reference: result.checkout.reference, paymentId: result.checkout.paymentId, amountLabel: result.checkout.amount ? naira(result.checkout.amount) : undefined });
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };

  const pulse = { transform: [{ scale: total.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }] };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Notice message={error} tone="error" />
        <Text style={[text.caption, { color: colors.textMuted, marginBottom: 8 }]}>Who is posting this vacancy</Text>
        <View style={styles.typeRow}>
          {([
            { key: 'school', label: 'For my school', note: ctx.school.name },
            { key: 'personal', label: 'Personal', note: 'Only your name shows' },
          ] as const).map(o => {
            const on = postingType === o.key;
            return (
              <PressableScale key={o.key} onPress={() => setPostingType(o.key)} style={[styles.typeBox, on && styles.typeBoxOn]}>
                <Text style={[styles.typeTitle, on && { color: colors.primary }]} numberOfLines={1}>{o.label}</Text>
                <Text style={styles.typeNote} numberOfLines={2}>{o.note}</Text>
              </PressableScale>
            );
          })}
        </View>
        <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>
          {postingType === 'school' ? 'The school name and logo will show at the top of the vacancy.' : 'Your name and photo will show at the top of the vacancy. The school name will not appear.'}
        </Text>
        <Input label="Job title" value={title} onChangeText={setTitle} maxLength={120} placeholder="For example Mathematics Teacher" icon="briefcase" />
        <Input label="Description" value={description} onChangeText={setDescription} multiline maxLength={5000} placeholder="Describe the role, requirements and how to apply" style={{ minHeight: 150, textAlignVertical: 'top' }} />
        <Input label="Application link (optional)" value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://" />

        {!editId ? (
          <View>
            <Text style={[text.caption, { color: colors.textMuted, marginBottom: 8 }]}>How long should it stay live</Text>
            <View style={styles.quick}>
              {QUICK_DAYS.map(n => {
                const on = dayCount === n;
                return (
                  <PressableScale key={n} onPress={() => setDays(String(n))} style={[styles.dayChip, on && styles.dayChipOn]}>
                    <Text style={[styles.dayChipText, on && { color: '#FFFFFF' }]}>{n + ' days'}</Text>
                  </PressableScale>
                );
              })}
            </View>
            <Input label="Or enter the number of days" value={days} onChangeText={v => setDays(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" />

            <Card style={{ marginBottom: spacing.lg }}>
              <View style={styles.row}>
                <Text style={[text.body, { color: colors.textMuted, flex: 1 }]}>{dayCount + (dayCount === 1 ? ' day' : ' days') + ' at ' + naira(pricing.pricePerDay)}</Text>
                <Text style={[text.bodyStrong, { color: colors.text }]}>{naira(price.base)}</Text>
              </View>
              {price.percent > 0 ? (
                <View style={[styles.row, { marginTop: spacing.sm }]}>
                  <Text style={[text.body, { color: colors.success, flex: 1 }]}>{'Discount ' + price.percent + ' percent'}</Text>
                  <Text style={[text.bodyStrong, { color: colors.success }]}>{'Less ' + naira(price.discount)}</Text>
                </View>
              ) : null}
              <View style={styles.totalRow}>
                <Text style={[text.bodyStrong, { color: colors.text }]}>Total</Text>
                <Animated.Text style={[styles.total, pulse]}>{price.total > 0 ? naira(price.total) : 'Free'}</Animated.Text>
              </View>
            </Card>
          </View>
        ) : (
          <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>The number of days and the price are fixed once a posting exists.</Text>
        )}

        <ShineButton title={editId ? 'Save changes' : price.total > 0 ? 'Save and pay ' + naira(price.total) : 'Post vacancy'} loading={busy} onPress={submit} />
        {!editId && price.total > 0 ? <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.md }]}>The server confirms the final amount before you pay.</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  typeRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  typeBox: { flex: 1, minHeight: 74, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, justifyContent: 'center' },
  typeBoxOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  typeTitle: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  typeNote: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  quick: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  dayChip: { flex: 1, height: 42, borderRadius: radius.lg, backgroundColor: '#EEF1F6', alignItems: 'center', justifyContent: 'center' },
  dayChipOn: { backgroundColor: colors.primary },
  dayChipText: { fontSize: 13.5, color: colors.textMuted, fontFamily: fonts.semibold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  total: { fontSize: 22, color: colors.primary, fontFamily: fonts.headingBold },
});
