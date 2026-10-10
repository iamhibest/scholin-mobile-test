import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Input, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { confirmAction } from '../lib/confirm';
import { addVacancyTier, deleteVacancyTier, fetchVacancyTiers } from '../lib/superAdmin';

type Msg = { message: string; tone: 'error' | 'success' };
const none: Msg = { message: '', tone: 'success' };

async function savePricing(patch: { price_per_day?: number; rotation_seconds?: number }) {
  const { data: existing, error: readError } = await supabase.from('vacancy_pricing').select('id').limit(1).maybeSingle();
  if (readError) {
    throw new Error('Could not read the current settings.');
  }
  const body = { ...patch, updated_at: new Date().toISOString() };
  const { error } = existing ? await supabase.from('vacancy_pricing').update(body).eq('id', existing.id) : await supabase.from('vacancy_pricing').insert(patch);
  if (error) {
    throw new Error(error.message || 'Could not save.');
  }
}

export default function SuperAdminVacancyScreen() {
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState('');
  const [seconds, setSeconds] = useState('');
  const [busy, setBusy] = useState('');
  const [priceMsg, setPriceMsg] = useState<Msg>(none);
  const [secMsg, setSecMsg] = useState<Msg>(none);
  const [tiers, setTiers] = useState<any[]>([]);
  const [minDays, setMinDays] = useState('');
  const [discount, setDiscount] = useState('');
  const [tierMsg, setTierMsg] = useState<Msg>(none);

  const load = useCallback(async () => {
    const { data } = await supabase.from('vacancy_pricing').select('*').limit(1).maybeSingle();
    setPrice(String(data && data.price_per_day !== null && data.price_per_day !== undefined ? data.price_per_day : 0));
    setSeconds(String(data && data.rotation_seconds ? data.rotation_seconds : 8));
    try {
      setTiers(await fetchVacancyTiers());
    } catch (e: any) {
      setTierMsg({ message: e.message, tone: 'error' });
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const savePrice = async () => {
    setPriceMsg(none);
    const v = parseFloat(price);
    if (isNaN(v) || v < 0) {
      setPriceMsg({ message: 'Please enter a valid price.', tone: 'error' });
      return;
    }
    setBusy('price');
    try {
      await savePricing({ price_per_day: v });
      setPriceMsg({ message: 'Price updated.', tone: 'success' });
    } catch (e: any) {
      setPriceMsg({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const saveSeconds = async () => {
    setSecMsg(none);
    const v = parseInt(seconds, 10);
    if (isNaN(v) || v < 3 || v > 120) {
      setSecMsg({ message: 'Please enter a value between 3 and 120 seconds.', tone: 'error' });
      return;
    }
    setBusy('seconds');
    try {
      await savePricing({ rotation_seconds: v });
      setSecMsg({ message: 'Banner speed updated. Schools see it the next time their dashboard loads.', tone: 'success' });
    } catch (e: any) {
      setSecMsg({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const addTier = async () => {
    setTierMsg(none);
    const d = parseInt(minDays, 10);
    const p = parseFloat(discount);
    if (!d || d < 1 || isNaN(p) || p < 0 || p > 100) {
      setTierMsg({ message: 'Enter at least 1 day and a discount between 0 and 100.', tone: 'error' });
      return;
    }
    setBusy('tier');
    try {
      await addVacancyTier(d, p);
      setMinDays('');
      setDiscount('');
      setTiers(await fetchVacancyTiers());
      setTierMsg({ message: 'Discount tier added.', tone: 'success' });
    } catch (e: any) {
      setTierMsg({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const removeTier = (t: any) => {
    confirmAction('Remove tier', 'Remove the ' + t.min_days + '+ days discount?', 'Remove', async () => {
      try {
        await deleteVacancyTier(t.id);
        setTiers(await fetchVacancyTiers());
      } catch (e: any) {
        setTierMsg({ message: e.message, tone: 'error' });
      }
    });
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={180} radius={24} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card style={{ marginBottom: spacing.xl }}>
          <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Price per day</Text>
          <Notice message={priceMsg.message} tone={priceMsg.tone} />
          <Input label="Amount (₦) per day" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0" />
          <Button title="Save price" loading={busy === 'price'} onPress={savePrice} />
        </Card>

        <Card>
          <Text style={[text.h3, { color: colors.text }]}>Dashboard banner speed</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>
            How long each vacancy stays on the dashboard banner before it slides to the next one. Use 3 to 120 seconds.
          </Text>
          <Notice message={secMsg.message} tone={secMsg.tone} />
          <Input label="Seconds per posting" value={seconds} onChangeText={setSeconds} keyboardType="number-pad" placeholder="8" />
          <Button title="Save banner speed" loading={busy === 'seconds'} onPress={saveSeconds} />
        </Card>

        <Card style={{ marginTop: spacing.xl }}>
          <Text style={[text.h3, { color: colors.text }]}>Discount tiers</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>
            Longer postings can get a percentage off. The highest tier a posting qualifies for is used.
          </Text>
          <Notice message={tierMsg.message} tone={tierMsg.tone} />
          {tiers.length === 0 ? (
            <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>No discount tiers yet. Postings are charged at full price whatever the length.</Text>
          ) : (
            tiers.map(t => (
              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={[text.body, { color: colors.text, flex: 1 }]}>{t.min_days + ' days or more: ' + t.discount_percent + '% off'}</Text>
                <Button title="Remove" variant="soft" onPress={() => removeTier(t)} />
              </View>
            ))
          )}
          <Input label="From how many days" value={minDays} onChangeText={setMinDays} keyboardType="number-pad" placeholder="e.g. 14" />
          <Input label="Discount percent" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" placeholder="e.g. 10" />
          <Button title="Add tier" variant="outline" loading={busy === 'tier'} onPress={addTier} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
});
