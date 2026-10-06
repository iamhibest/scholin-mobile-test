import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Input, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { fetchTermsAndAbout, saveSettings } from '../lib/superAdmin';

type Msg = { message: string; tone: 'error' | 'success' };
const none: Msg = { message: '', tone: 'success' };

export default function SuperAdminTermsAboutScreen() {
  const [loading, setLoading] = useState(true);
  const [terms, setTerms] = useState('');
  const [about, setAbout] = useState('');
  const [version, setVersion] = useState(1);
  const [termsMeta, setTermsMeta] = useState('');
  const [aboutMeta, setAboutMeta] = useState('');
  const [busy, setBusy] = useState('');
  const [termsMsg, setTermsMsg] = useState<Msg>(none);
  const [aboutMsg, setAboutMsg] = useState<Msg>(none);

  const load = useCallback(async () => {
    try {
      const s = await fetchTermsAndAbout();
      const v = s && s.terms_version ? s.terms_version : 1;
      setVersion(v);
      setTerms(s && s.terms_and_conditions ? s.terms_and_conditions : '');
      setAbout(s && s.about_scholin ? s.about_scholin : '');
      setTermsMeta(s ? 'Currently version ' + v + (s.terms_updated_at ? '. Last updated ' + new Date(s.terms_updated_at).toLocaleDateString() + '.' : '.') : 'Not set yet. It is created when you save.');
      setAboutMeta(s && s.about_updated_at ? 'Last updated ' + new Date(s.about_updated_at).toLocaleDateString() + '.' : 'Not set yet.');
    } catch {
      setTermsMsg({ message: 'Could not load the current content.', tone: 'error' });
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const saveTerms = async () => {
    setTermsMsg(none);
    if (!terms.trim()) {
      setTermsMsg({ message: 'Terms and Conditions cannot be empty.', tone: 'error' });
      return;
    }
    setBusy('terms');
    try {
      const next = version + 1;
      await saveSettings({ terms_and_conditions: terms.trim(), terms_version: next, terms_updated_at: new Date().toISOString() });
      setTermsMsg({ message: 'Saved as version ' + next + '. Users who accepted an earlier version will need to accept again.', tone: 'success' });
      await load();
    } catch (e: any) {
      setTermsMsg({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const saveAbout = async () => {
    setAboutMsg(none);
    if (!about.trim()) {
      setAboutMsg({ message: 'About Scholin cannot be empty.', tone: 'error' });
      return;
    }
    setBusy('about');
    try {
      await saveSettings({ about_scholin: about.trim(), about_updated_at: new Date().toISOString() });
      setAboutMsg({ message: 'About Scholin saved.', tone: 'success' });
      await load();
    } catch (e: any) {
      setAboutMsg({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  if (loading) {
    return (
      <Screen>
        <Skeleton height={240} radius={24} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text }]}>Terms and Conditions</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>
            Every save creates a new version, and people who accepted an earlier one are asked to accept again.
          </Text>
          <Text style={[text.bodyStrong, { color: colors.text, marginBottom: spacing.md }]}>{termsMeta}</Text>
          <Notice message={termsMsg.message} tone={termsMsg.tone} />
          <Input label="Terms and Conditions" value={terms} onChangeText={setTerms} multiline textAlignVertical="top" placeholder="Write the terms here" style={{ minHeight: 240 }} />
          <Button title="Save as new version" loading={busy === 'terms'} onPress={saveTerms} />
        </Card>

        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text }]}>About Scholin</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>{aboutMeta}</Text>
          <Notice message={aboutMsg.message} tone={aboutMsg.tone} />
          <Input label="About Scholin" value={about} onChangeText={setAbout} multiline textAlignVertical="top" placeholder="Tell people about Scholin" style={{ minHeight: 180 }} />
          <Button title="Save about" loading={busy === 'about'} onPress={saveAbout} />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  block: { marginBottom: spacing.xl },
});
