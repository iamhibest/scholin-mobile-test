import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Input, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';

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

  const load = useCallback(async () => {
    const { data } = await supabase.from('vacancy_pricing').select('*').limit(1).maybeSingle();
    setPrice(String(data && data.price_per_day !== null && data.price_per_day !== undefined ? data.price_per_day : 0));
    setSeconds(String(data && data.rotation_seconds ? data.rotation_seconds : 8));
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
});
