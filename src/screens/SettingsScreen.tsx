import React, { useCallback, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, ListRow, Screen } from '../components';
import { colors, spacing, text } from '../theme';
import { notificationsAllowed, turnOnNotifications } from '../lib/push';

export default function SettingsScreen({ navigation }: any) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    setAllowed(await notificationsAllowed());
  }, []);

  useFocusEffect(
    useCallback(() => {
      check();
    }, [check]),
  );

  const enable = async () => {
    setBusy(true);
    const ok = await turnOnNotifications();
    setAllowed(ok);
    if (!ok) {
      Linking.openSettings().catch(() => {});
    }
    setBusy(false);
  };

  return (
    <Screen scroll>
      <Card style={styles.group}>
        <ListRow title="Terms and Conditions" subtitle="The rules for using Scholin" icon="file" onPress={() => navigation.navigate('Terms', { tab: 'terms' })} />
        <ListRow title="Privacy Policy" subtitle="How your information is handled" icon="shield" onPress={() => navigation.navigate('Terms', { tab: 'privacy' })} />
        <ListRow title="Contact us" subtitle="Reach the Scholin team" icon="phone" onPress={() => navigation.navigate('Terms', { tab: 'contact' })} />
        <ListRow title="About Scholin" subtitle="Who we are" icon="info" onPress={() => navigation.navigate('Terms', { tab: 'about' })} />
      </Card>

      <Card style={styles.group}>
        <View style={{ padding: spacing.md }}>
          <Text style={[text.bodyStrong, { color: colors.text }]}>Notifications</Text>
          <Text style={[text.small, { color: colors.textMuted, marginTop: 4 }]}>
            {allowed === null
              ? 'Checking...'
              : allowed
                ? 'On. You will get announcements and updates on this phone, even when the app is closed.'
                : 'Off. Turn them on to get announcements and updates on this phone, even when the app is closed.'}
          </Text>
          {allowed === false ? <Button title="Turn on notifications" onPress={enable} loading={busy} style={{ marginTop: spacing.md }} /> : null}
          <Button title="Notification check" variant="soft" onPress={() => navigation.navigate('Push')} style={{ marginTop: spacing.md }} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: spacing.lg, padding: 0 },
});
