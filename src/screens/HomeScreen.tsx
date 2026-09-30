import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, Card, ListRow, Screen, ScreenHeader, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';

export default function HomeScreen({ navigation }: any) {
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setChecked(true);
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] });
  }

  return (
    <Screen scroll>
      <ScreenHeader title="Home" subtitle="Role dashboards arrive in the next phase." />
      <Card>
        <View style={styles.row}>
          <Avatar name={email || ''} size={52} />
          <View style={styles.flex}>
            <Text style={[text.small, { color: colors.textMuted }]}>Signed in as</Text>
            {checked ? (
              <Text style={[text.bodyStrong, { color: colors.text }]}>{email || 'Not signed in'}</Text>
            ) : (
              <Skeleton width={180} height={16} />
            )}
          </View>
        </View>
      </Card>
      <View style={{ marginTop: spacing.lg }}>
        <ListRow title="Developer tools" subtitle="Hardware tests, connection check and logs" icon="bug" tint={colors.accentSoft} iconColor={colors.accent} onPress={() => navigation.navigate('Developer')} />
      </View>
      <Button title="Sign out" variant="danger" icon="logout" onPress={signOut} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
