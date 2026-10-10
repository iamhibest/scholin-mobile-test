import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Input, Notice, Screen, Skeleton, SwitchRow } from '../components';
import { colors, spacing, text } from '../theme';
import { confirmAction } from '../lib/confirm';
import { addCommissionTier, deleteCommissionTier, fetchCommissionTiers, naira } from '../lib/superAdmin';

function range(t: any) {
  return t.max_amount === null ? naira(t.min_amount) + ' and above' : naira(t.min_amount) + ' to ' + naira(t.max_amount);
}
function overlaps(aMin: number, aMax: number | null, bMin: number, bMax: number | null) {
  const aTop = aMax === null ? Infinity : aMax;
  const bTop = bMax === null ? Infinity : bMax;
  return aMin <= bTop && aTop >= bMin;
}

export default function SuperAdminCommissionTiersScreen() {
  const [tiers, setTiers] = useState<any[] | null>(null);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [fee, setFee] = useState('');
  const [andAbove, setAndAbove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  const load = useCallback(async () => {
    try {
      setTiers(await fetchCommissionTiers());
    } catch (e: any) {
      setTiers(prev => prev || []);
      setMsg({ message: e.message, tone: 'error' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Gaps are allowed, but you should know about them before a parent pays an amount that matches no range.
  const gaps: string[] = [];
  if (tiers && tiers.length) {
    if (Number(tiers[0].min_amount) > 0) {
      gaps.push(naira(0) + ' to ' + naira(Number(tiers[0].min_amount) - 1));
    }
    for (let i = 0; i < tiers.length - 1; i++) {
      const top = tiers[i].max_amount;
      const next = Number(tiers[i + 1].min_amount);
      if (top !== null && Number(top) + 1 < next) {
        gaps.push(naira(Number(top) + 1) + ' to ' + naira(next - 1));
      }
    }
    if (!tiers.some(t => t.max_amount === null)) {
      gaps.push('above ' + naira(tiers[tiers.length - 1].max_amount) + ' (no "and above" range set)');
    }
  }

  const add = async () => {
    setMsg({ message: '', tone: 'success' });
    const fail = (m: string) => setMsg({ message: m, tone: 'error' });
    if (min.trim() === '' || Number(min) < 0) {
      return fail('Enter a minimum amount (₦0 or more).');
    }
    if (!andAbove && (max.trim() === '' || Number(max) <= Number(min))) {
      return fail('Enter a maximum greater than the minimum, or switch on "and above".');
    }
    if (fee.trim() === '' || Number(fee) < 0) {
      return fail('Enter the flat commission amount for this range.');
    }
    const minN = Number(min);
    const maxN = andAbove ? null : Number(max);
    const existing = tiers || [];
    const conflict = existing.find(t => overlaps(minN, maxN, Number(t.min_amount), t.max_amount === null ? null : Number(t.max_amount)));
    if (conflict) {
      return fail('This range overlaps an existing one (' + range(conflict) + '). Remove or adjust it first.');
    }
    if (andAbove && existing.some(t => t.max_amount === null)) {
      return fail('There is already an "and above" range. Remove it first if you want to replace it.');
    }
    setBusy(true);
    try {
      await addCommissionTier(minN, maxN, Number(fee));
      setMin('');
      setMax('');
      setFee('');
      setAndAbove(false);
      setMsg({ message: 'Range added.', tone: 'success' });
      await load();
    } catch (e: any) {
      fail(e.message);
    }
    setBusy(false);
  };

  const remove = (t: any) => {
    confirmAction('Remove range', 'Payments in this amount range will be refused until you add a new range covering it.', 'Remove', async () => {
      try {
        await deleteCommissionTier(t.id);
        await load();
      } catch (e: any) {
        setMsg({ message: e.message, tone: 'error' });
      }
    });
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>
          Your flat commission on each online fee payment, set by the payment amount. Ranges cannot overlap.
        </Text>
        {tiers === null ? (
          <Skeleton height={120} radius={20} />
        ) : (
          <Card style={styles.block}>
            <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Current ranges</Text>
            {tiers.length === 0 ? (
              <Text style={[text.small, { color: colors.textMuted }]}>No commission ranges yet. Online payments will be refused until you add one.</Text>
            ) : (
              tiers.map(t => (
                <View key={t.id} style={styles.tier}>
                  <View style={{ flex: 1 }}>
                    <Text style={[text.bodyStrong, { color: colors.text }]}>{range(t)}</Text>
                    <Text style={[text.small, { color: colors.textMuted }]}>{'Commission: ' + naira(t.commission_amount) + ' flat'}</Text>
                  </View>
                  <Button title="Remove" variant="soft" onPress={() => remove(t)} />
                </View>
              ))
            )}
            {tiers.length > 0 ? (
              <Text style={[text.small, { color: gaps.length ? colors.danger : colors.success, marginTop: spacing.md }]}>
                {gaps.length
                  ? 'Uncovered amount' + (gaps.length > 1 ? 's' : '') + ': ' + gaps.join(', ') + '. A payment in ' + (gaps.length > 1 ? 'these ranges' : 'this range') + ' will be refused until a range covers it.'
                  : 'Every amount from ₦0 upward is covered.'}
              </Text>
            ) : null}
          </Card>
        )}

        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Add a range</Text>
          <Notice message={msg.message} tone={msg.tone} />
          <Input label="From amount (₦)" value={min} onChangeText={setMin} keyboardType="number-pad" placeholder="0" />
          <SwitchRow label="And above" desc="No upper limit for this range." value={andAbove} onChange={v => { setAndAbove(v); if (v) setMax(''); }} />
          {!andAbove ? <Input label="Up to amount (₦)" value={max} onChangeText={setMax} keyboardType="number-pad" placeholder="e.g. 5000" /> : null}
          <Input label="Flat commission (₦)" value={fee} onChangeText={setFee} keyboardType="decimal-pad" placeholder="e.g. 100" />
          <Button title="Add range" loading={busy} onPress={add} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  block: { marginBottom: spacing.xl },
  tier: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
