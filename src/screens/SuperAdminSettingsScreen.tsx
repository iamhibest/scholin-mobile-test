import React, { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Input, Notice, PhotoField, Screen, Skeleton, SwitchRow } from '../components';
import { colors, spacing, text } from '../theme';
import { fetchSettings, saveSettings } from '../lib/superAdmin';

type Msg = { message: string; tone: 'error' | 'success' };
const none: Msg = { message: '', tone: 'success' };

export default function SuperAdminSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [logo, setLogo] = useState('');
  const [icon, setIcon] = useState('');
  const [label, setLabel] = useState('Support');
  const [link, setLink] = useState('');
  const [photos, setPhotos] = useState(true);
  const [posting, setPosting] = useState(true);
  const [page, setPage] = useState(true);
  const [register, setRegister] = useState(true);
  const [busy, setBusy] = useState('');
  const [logoMsg, setLogoMsg] = useState<Msg>(none);
  const [supportMsg, setSupportMsg] = useState<Msg>(none);
  const [toggleMsg, setToggleMsg] = useState<Msg>(none);

  const load = useCallback(async () => {
    try {
      const s = await fetchSettings();
      setLogo(s && s.app_logo_url ? s.app_logo_url : '');
      setIcon(s && s.support_contact_icon_url ? s.support_contact_icon_url : '');
      setLabel(s && s.support_contact_label ? s.support_contact_label : 'Support');
      setLink(s && s.support_contact_url ? s.support_contact_url : '');
      setPhotos(!s || s.allow_student_photos !== false);
      setPosting(!s || s.vacancy_posting_enabled !== false);
      setPage(!s || s.vacancy_page_enabled !== false);
      setRegister(!s || s.register_enabled !== false);
    } catch {
      setToggleMsg({ message: 'Could not load the current settings.', tone: 'error' });
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const saveLogo = async () => {
    setLogoMsg(none);
    setBusy('logo');
    try {
      await saveSettings({ app_logo_url: logo });
      setLogoMsg({ message: 'Logo saved.', tone: 'success' });
    } catch (e: any) {
      setLogoMsg({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const saveSupport = async () => {
    setSupportMsg(none);
    setBusy('support');
    try {
      await saveSettings({ support_contact_icon_url: icon, support_contact_label: label.trim() || 'Support', support_contact_url: link.trim() });
      setSupportMsg({ message: 'Support button saved.', tone: 'success' });
    } catch (e: any) {
      setSupportMsg({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const toggle = async (column: string, value: boolean, set: (v: boolean) => void) => {
    setToggleMsg(none);
    set(value);
    try {
      await saveSettings({ [column]: value });
    } catch (e: any) {
      set(!value);
      setToggleMsg({ message: e.message, tone: 'error' });
    }
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
          <Text style={[text.h3, { color: colors.text }]}>App logo</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>Replaces the S badge shown across the app for everyone.</Text>
          <Notice message={logoMsg.message} tone={logoMsg.tone} />
          <PhotoField name="Scholin" url={logo} schoolId={null} onChange={setLogo} label="Logo" />
          <Button title="Save logo" loading={busy === 'logo'} onPress={saveLogo} />
        </Card>

        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text }]}>Support contact button</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>
            Shown in every user's menu near Sign out. Add an icon and where it should open. Leave the link empty to hide the button.
          </Text>
          <Notice message={supportMsg.message} tone={supportMsg.tone} />
          <PhotoField name="Support" url={icon} schoolId={null} onChange={setIcon} label="Icon" />
          <Input label="Label" value={label} onChangeText={setLabel} placeholder="Support" />
          <Input label="Link" value={link} onChangeText={setLink} placeholder="https://wa.me/2348000000000" autoCapitalize="none" keyboardType="url" />
          <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>A wa.me link opens WhatsApp directly. Any normal https link works too.</Text>
          <Button title="Save support button" loading={busy === 'support'} onPress={saveSupport} />
        </Card>

        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text }]}>Storage and features</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>Changes apply to every school and are saved as soon as you switch them.</Text>
          <Notice message={toggleMsg.message} tone={toggleMsg.tone} />
          <SwitchRow label="Allow student photo uploads" desc="Off blocks new uploads to save storage. Existing photos stay." value={photos} onChange={v => toggle('allow_student_photos', v, setPhotos)} />
          <SwitchRow label="Vacancy posting" desc="Off hides Post a Vacancy everywhere. Live posts still show." value={posting} onChange={v => toggle('vacancy_posting_enabled', v, setPosting)} />
          <SwitchRow label="Vacancy page" desc="Off hides everything about vacancies: links, banner and pages." value={page} onChange={v => toggle('vacancy_page_enabled', v, setPage)} />
          <SwitchRow label="Register" desc="Off hides the attendance Register for every school." value={register} onChange={v => toggle('register_enabled', v, setRegister)} />
        </Card>

      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  block: { marginBottom: spacing.xl },
});
