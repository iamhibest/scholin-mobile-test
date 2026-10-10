import React, { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Input, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { confirmAction } from '../lib/confirm';
import { fetchSettings, saveSettings } from '../lib/superAdmin';

export default function SuperAdminPaymentTermsScreen() {
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [version, setVersion] = useState(1);
  const [meta, setMeta] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  const load = useCallback(async () => {
    try {
      const s = await fetchSettings();
      const v = s && s.payment_terms_version ? s.payment_terms_version : 1;
      setVersion(v);
      setBody(s && s.payment_terms_and_conditions ? s.payment_terms_and_conditions : '');
      setMeta(
        s && s.payment_terms_and_conditions
          ? 'Currently version ' + v + (s.payment_terms_updated_at ? '. Last updated ' + new Date(s.payment_terms_updated_at).toLocaleDateString() + '.' : '.')
          : 'Not set yet. School admins will not be asked to accept anything until you save this.',
      );
    } catch {
      setMsg({ message: 'Could not load the current terms.', tone: 'error' });
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const save = async () => {
    setMsg({ message: '', tone: 'success' });
    if (!body.trim()) {
      setMsg({ message: 'Payment Terms of Use cannot be empty. Use Delete instead if you want to remove them.', tone: 'error' });
      return;
    }
    setBusy('save');
    try {
      const next = version + 1;
      await saveSettings({ payment_terms_and_conditions: body.trim(), payment_terms_version: next, payment_terms_updated_at: new Date().toISOString() });
      setMsg({ message: 'Saved as version ' + next + '. School admins who accepted an earlier version will be asked to accept again.', tone: 'success' });
      await load();
    } catch (e: any) {
      setMsg({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const remove = () => {
    confirmAction('Delete payment terms', 'Until you add new terms, school admins will not be asked to accept anything before verifying a payout bank account.', 'Delete', async () => {
      setBusy('delete');
      try {
        await saveSettings({ payment_terms_and_conditions: null, payment_terms_updated_at: new Date().toISOString() });
        setBody('');
        setMsg({ message: 'Payment Terms of Use deleted.', tone: 'success' });
        await load();
      } catch (e: any) {
        setMsg({ message: e.message, tone: 'error' });
      }
      setBusy('');
    });
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={220} radius={24} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>
            School admins must accept these terms before verifying a payout bank account. Each save creates a new version and asks everyone to accept again.
          </Text>
          <Text style={[text.bodyStrong, { color: colors.text, marginBottom: spacing.md }]}>{meta}</Text>
          <Notice message={msg.message} tone={msg.tone} />
          <Input label="Payment Terms of Use" value={body} onChangeText={setBody} multiline textAlignVertical="top" placeholder="Write the terms here" style={{ minHeight: 260 }} />
          <Button title="Save as new version" loading={busy === 'save'} onPress={save} />
          <Button title="Delete payment terms" variant="danger" style={{ marginTop: spacing.md }} loading={busy === 'delete'} onPress={remove} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
});
