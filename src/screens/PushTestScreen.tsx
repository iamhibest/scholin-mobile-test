import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Share, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Icon, Screen } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { getFcmToken, notificationsAllowed, registerDeviceDetailed, turnOnNotifications } from '../lib/push';

type Step = { label: string; ok: boolean | null; detail: string };

// Checks each link in the notification chain and says which one is broken.
export default function PushTestScreen() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [token, setToken] = useState('');
  const [running, setRunning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    const out: Step[] = [];
    const show = () => setSteps([...out]);

    const { data } = await supabase.auth.getSession();
    out.push({ label: 'Signed in', ok: !!data.session, detail: data.session ? (data.session.user.email || 'Yes') : 'Sign in first.' });
    show();

    const allowed = await notificationsAllowed();
    out.push({ label: 'Phone allows notifications for Scholin', ok: allowed, detail: allowed ? 'Yes' : 'Off. Tap "Turn on notifications" below.' });
    show();

    let tok = '';
    try {
      tok = await getFcmToken();
      out.push({ label: 'Firebase gave this phone a token', ok: !!tok, detail: tok ? 'Yes' : 'No token. The Firebase file in the build may be wrong.' });
    } catch (e: any) {
      out.push({ label: 'Firebase gave this phone a token', ok: false, detail: (e && e.message) || 'Failed. The Firebase file in the build may be wrong.' });
    }
    setToken(tok);
    show();

    if (data.session && allowed && tok) {
      const r = await registerDeviceDetailed();
      out.push({ label: 'Token saved on the server', ok: r.ok, detail: r.ok ? 'Yes' : r.message });
      show();
      if (r.ok) {
        const { data: st, error } = await supabase.rpc('my_push_token_status', { p_token: tok });
        if (error) {
          out.push({ label: 'Server can see the token', ok: false, detail: error.message });
        } else if (st && st.table_exists === false) {
          out.push({ label: 'Server can see the token', ok: false, detail: 'The push_tokens table was not found.' });
        } else {
          out.push({
            label: 'Server can see the token',
            ok: !!(st && st.this_phone_saved),
            detail: st && st.this_phone_saved ? 'Yes. Rows saved for you: ' + st.rows_for_me : 'The token was not found in the table.',
          });
        }
        show();
      }
    }
    setRunning(false);
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  // Sends a real notification through the server to this person's phones and reports exactly what Firebase said.
  const sendTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r: any = await supabase.functions.invoke('send-push-notification', { body: { category: 'test', title: 'Scholin test', message: 'If you can see this, notifications are working.' } });
      if (r.error) {
        setTestResult({ ok: false, text: 'The server said: ' + (r.error.message || 'error') });
      } else {
        const d = r.data || {};
        if (d.sent > 0) {
          setTestResult({ ok: true, text: 'Sent to ' + d.sent + ' device(s). Pull down the notification bar on this phone. If nothing shows, check the phone notification settings.' });
        } else {
          const why = d.errors && Object.keys(d.errors).length ? Object.keys(d.errors).join('; ') : d.reason || 'Nothing was sent.';
          setTestResult({ ok: false, text: 'Not delivered. ' + why + (d.project_id ? ' (server Firebase project: ' + d.project_id + ')' : '') });
        }
      }
    } catch (e: any) {
      setTestResult({ ok: false, text: (e && e.message) || 'Could not reach the server.' });
    }
    setTesting(false);
  };

  const allowedStep = steps.find(s => s.label.indexOf('allows') >= 0);

  return (
    <Screen scroll>
      <Card>
        <Text style={[text.h3, { color: colors.text }]}>Notification check</Text>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          {steps.map((s, i) => (
            <View key={i} style={styles.row}>
              <Icon name={s.ok ? 'check' : 'close'} size={18} color={s.ok ? colors.success : colors.danger} />
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, { color: colors.text }]}>{s.label}</Text>
                <Text style={[text.small, { color: s.ok ? colors.textMuted : colors.danger }]}>{s.detail}</Text>
              </View>
            </View>
          ))}
        </View>
        <Button title="Check again" variant="outline" loading={running} onPress={run} style={{ marginTop: spacing.lg }} />
        {allowedStep && !allowedStep.ok ? (
          <Button
            title="Turn on notifications"
            onPress={async () => {
              const ok = await turnOnNotifications();
              if (!ok) {
                Linking.openSettings().catch(() => {});
              }
              run();
            }}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
        <Button title="Send me a test notification" variant="soft" loading={testing} onPress={sendTest} style={{ marginTop: spacing.md }} />
        {testResult ? (
          <Text style={[text.small, { color: testResult.ok ? colors.success : colors.danger, marginTop: spacing.md }]}>{testResult.text}</Text>
        ) : null}
        <Button title="Open phone notification settings" variant="ghost" onPress={() => Linking.openSettings().catch(() => {})} style={{ marginTop: spacing.sm }} />
      </Card>

      {token ? (
        <Card style={{ marginTop: spacing.lg }}>
          <Text style={[text.bodyStrong, { color: colors.text }]}>This phone's token</Text>
          <Text style={[text.small, { color: colors.textMuted, marginTop: 4 }]}>Use it to send a test message from the Firebase console.</Text>
          <Text selectable style={styles.token}>{token}</Text>
          <Button title="Share or copy token" variant="soft" onPress={() => Share.share({ message: token })} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  token: { fontSize: 11, color: colors.text, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: spacing.md, marginVertical: spacing.md },
});
