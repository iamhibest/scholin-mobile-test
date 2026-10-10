import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Input, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { confirmAction } from '../lib/confirm';
import { addTier, deleteTier, fetchSettings, fetchTiers, saveSettings } from '../lib/superAdmin';

type Msg = { message: string; tone: 'error' | 'success' };
const none: Msg = { message: '', tone: 'success' };

export default function SuperAdminSubscriptionPricingScreen() {
  const [loading, setLoading] = useState(true);
  const [trial, setTrial] = useState('');
  const [price, setPrice] = useState('');
  const [tiers, setTiers] = useState<any[]>([]);
  const [minMonths, setMinMonths] = useState('');
  const [discount, setDiscount] = useState('');
  const [busy, setBusy] = useState('');
  const [trialMsg, setTrialMsg] = useState<Msg>(none);
  const [priceMsg, setPriceMsg] = useState<Msg>(none);
  const [tierMsg, setTierMsg] = useState<Msg>(none);

  const load = useCallback(async () => {
    try {
      const s = await fetchSettings();
      setTrial(String(s && s.trial_days !== null && s.trial_days !== undefined ? s.trial_days : 7));
      setPrice(String(s && s.subscription_price_per_month ? s.subscription_price_per_month : 0));
    } catch {
      setPriceMsg({ message: 'Could not load the current settings.', tone: 'error' });
    }
    try {
      setTiers(await fetchTiers());
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

  const run = async (key: string, setMsg: (m: Msg) => void, work: () => Promise<string>) => {
    setMsg(none);
    setBusy(key);
    try {
      setMsg({ message: await work(), tone: 'success' });
    } catch (e: any) {
      setMsg({ message: e && e.message ? e.message : 'Something went wrong.', tone: 'error' });
    }
    setBusy('');
  };

  const saveTrial = () => {
    const d = parseInt(trial, 10);
    if (isNaN(d) || d < 0) {
      setTrialMsg({ message: 'Please enter a valid number of days.', tone: 'error' });
      return;
    }
    run('trial', setTrialMsg, async () => {
      await saveSettings({ trial_days: d });
      return 'Trial length updated.';
    });
  };

  const savePrice = () => {
    const v = parseFloat(price);
    if (isNaN(v) || v < 0) {
      setPriceMsg({ message: 'Please enter a valid price.', tone: 'error' });
      return;
    }
    run('price', setPriceMsg, async () => {
      await saveSettings({ subscription_price_per_month: v });
      return 'Price updated.';
    });
  };

  const add = () => {
    const m = parseInt(minMonths, 10);
    const d = parseFloat(discount);
    if (!m || m < 1 || isNaN(d) || d < 0 || d > 100) {
      setTierMsg({ message: 'Enter at least 1 month and a discount between 0 and 100.', tone: 'error' });
      return;
    }
    run('tier', setTierMsg, async () => {
      await addTier(m, d);
      setMinMonths('');
      setDiscount('');
      setTiers(await fetchTiers());
      return 'Discount tier added.';
    });
  };

  const remove = (t: any) => {
    confirmAction('Remove tier', 'Remove the ' + t.min_months + '+ months discount?', 'Remove', async () => {
      try {
        await deleteTier(t.id);
        setTiers(await fetchTiers());
      } catch (e: any) {
        setTierMsg({ message: e.message, tone: 'error' });
      }
    });
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={200} radius={24} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text }]}>Free trial length</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>How many days a new school gets before it needs to subscribe.</Text>
          <Notice message={trialMsg.message} tone={trialMsg.tone} />
          <Input label="Trial days" value={trial} onChangeText={setTrial} keyboardType="number-pad" />
          <Button title="Save trial length" loading={busy === 'trial'} onPress={saveTrial} />
        </Card>

        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text }]}>Price per month</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>The full monthly price before any discount.</Text>
          <Notice message={priceMsg.message} tone={priceMsg.tone} />
          <Input label="Amount (₦) per month" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          <Button title="Save price" loading={busy === 'price'} onPress={savePrice} />
        </Card>

        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text }]}>Discount tiers</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>
            Longer subscriptions can get a percentage off. The highest tier a school qualifies for is used.
          </Text>
          <Notice message={tierMsg.message} tone={tierMsg.tone} />
          {tiers.length === 0 ? (
            <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>No discount tiers yet. Subscriptions are charged at full price whatever the length.</Text>
          ) : (
            tiers.map(t => (
              <View key={t.id} style={styles.tier}>
                <Text style={[text.body, { color: colors.text, flex: 1 }]}>{t.min_months + ' months or more: ' + t.discount_percent + '% off'}</Text>
                <Button title="Remove" variant="soft" onPress={() => remove(t)} />
              </View>
            ))
          )}
          <Input label="From how many months" value={minMonths} onChangeText={setMinMonths} keyboardType="number-pad" placeholder="e.g. 8" />
          <Input label="Discount percent" value={discount} onChangeText={setDiscount} keyboardType="decimal-pad" placeholder="e.g. 10" />
          <Button title="Add tier" variant="outline" loading={busy === 'tier'} onPress={add} />
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
