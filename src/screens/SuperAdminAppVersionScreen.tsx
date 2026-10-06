import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Input, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { confirmAction } from '../lib/confirm';
import { fetchVersionSettings, saveSettings } from '../lib/superAdmin';

type Msg = { message: string; tone: 'error' | 'success' };
const none: Msg = { message: '', tone: 'success' };

function validVersion(v: string) {
  return /^\d+(\.\d+){0,2}$/.test(v);
}
function validUrl(v: string) {
  return /^https?:\/\/[^\s]+\.[^\s]+/i.test(v);
}

export default function SuperAdminAppVersionScreen() {
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState('');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [pushedAt, setPushedAt] = useState<string | null>(null);
  const [liveVersion, setLiveVersion] = useState('');
  const [busy, setBusy] = useState('');
  const [verMsg, setVerMsg] = useState<Msg>(none);
  const [pushMsg, setPushMsg] = useState<Msg>(none);

  const load = useCallback(async () => {
    try {
      const s = await fetchVersionSettings();
      setVersion(s && s.app_latest_version ? s.app_latest_version : '');
      setUrl(s && s.app_update_url ? s.app_update_url : '');
      setTitle(s && s.app_update_title ? s.app_update_title : '');
      setMessage(s && s.app_update_message ? s.app_update_message : '');
      setPushedAt(s && s.app_update_pushed_at ? s.app_update_pushed_at : null);
      setLiveVersion(s && s.app_latest_version ? s.app_latest_version : '?');
    } catch (e: any) {
      setVerMsg({ message: e.message, tone: 'error' });
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const check = (set: (m: Msg) => void) => {
    if (!version.trim() || !validVersion(version.trim())) {
      set({ message: 'Enter the latest version as numbers separated by dots, like 1.1.0.', tone: 'error' });
      return false;
    }
    if (!url.trim() || !validUrl(url.trim())) {
      set({ message: 'Enter a valid download link starting with https://', tone: 'error' });
      return false;
    }
    return true;
  };

  const form = () => ({ app_latest_version: version.trim(), app_update_url: url.trim(), app_update_title: title.trim() || null, app_update_message: message.trim() || null });

  const run = async (key: string, set: (m: Msg) => void, patch: Record<string, any>, ok: string) => {
    setBusy(key);
    try {
      await saveSettings(patch);
      set({ message: ok, tone: 'success' });
      await load();
    } catch (e: any) {
      set({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const save = () => {
    setVerMsg(none);
    if (check(setVerMsg)) {
      // Saving details never touches the push time, so preparing a release cannot show a popup to anyone.
      run('save', setVerMsg, form(), 'Saved. Nobody has been notified yet. Use Push update now when the new APK is ready.');
    }
  };

  const push = () => {
    setPushMsg(none);
    if (!check(setPushMsg)) {
      return;
    }
    confirmAction('Push update', 'Show the Upgrade Now popup for version ' + version.trim() + ' to everyone on an older version?', 'Push update', () => {
      // Details and push time are saved in one write, so nobody sees a popup that points at a half updated link.
      run('push', setPushMsg, { ...form(), app_update_pushed_at: new Date().toISOString() }, 'Update pushed. People on an older version will see the popup the next time they open the app.');
    }, false);
  };

  const withdraw = () => {
    setPushMsg(none);
    confirmAction('Withdraw update', 'Stop showing the update popup to everyone?', 'Withdraw', () => {
      run('withdraw', setPushMsg, { app_update_pushed_at: null }, 'Popup withdrawn. No one will see it until you push again.');
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
        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text }]}>Update details</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>
            Prepare a release here. Saving does not notify anyone. Upload the new APK first, then paste its download link.
          </Text>
          <Notice message={verMsg.message} tone={verMsg.tone} />
          <Input label="Latest version" value={version} onChangeText={setVersion} placeholder="1.1.0" autoCapitalize="none" keyboardType="numbers-and-punctuation" />
          <Input label="Download link" value={url} onChangeText={setUrl} placeholder="https://" autoCapitalize="none" keyboardType="url" />
          <Input label="Popup title (optional)" value={title} onChangeText={setTitle} placeholder="A new version is ready" />
          <Input label="Popup message (optional)" value={message} onChangeText={setMessage} multiline textAlignVertical="top" style={{ minHeight: 90 }} />
          <Button title="Save details" variant="outline" loading={busy === 'save'} onPress={save} />
        </Card>

        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text }]}>Push to users</Text>
          <Text style={[text.small, { color: pushedAt ? colors.success : colors.textMuted, marginVertical: spacing.md }]}>
            {pushedAt
              ? 'Live. Version ' + liveVersion + ' was pushed on ' + new Date(pushedAt).toLocaleString() + '.'
              : 'Not pushed. No one is being shown an update popup right now.'}
          </Text>
          <Notice message={pushMsg.message} tone={pushMsg.tone} />
          <Button title="Push update now" loading={busy === 'push'} onPress={push} />
          {pushedAt ? <Button title="Stop showing the popup" variant="soft" style={{ marginTop: spacing.md }} loading={busy === 'withdraw'} onPress={withdraw} /> : null}
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  block: { marginBottom: spacing.xl },
});
