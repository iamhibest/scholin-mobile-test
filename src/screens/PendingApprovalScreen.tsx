import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Icon, Screen } from '../components';
import { colors, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { saveLastDestination } from '../lib/storage';

export default function PendingApprovalScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');

  async function check() {
    setLoading(true);
    setNote('');
    const { data: auth } = await supabase.auth.getUser();
    const { data } = await supabase.from('school_members').select('id').eq('profile_id', auth.user?.id).eq('is_active', true);
    setLoading(false);
    if (data && data.length > 0) {
      await saveLastDestination('Home');
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } else {
      setNote('Not approved yet. Check again in a little while.');
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  return (
    <Screen background={colors.surface}>
      <View style={styles.center}>
        <View style={styles.circle}>
          <Icon name="check" size={34} color={colors.primary} />
        </View>
        <Text style={[text.h1, styles.title]}>Waiting for approval</Text>
        <Text style={[text.body, styles.body]}>Your request to join has been sent. Once your school's admin approves you, you'll get full access automatically.</Text>
        {note ? <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.lg }]}>{note}</Text> : null}
        <Button title="Check again" variant="outline" onPress={check} loading={loading} style={styles.btn} />
        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  circle: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.primary, marginTop: spacing.xl, textAlign: 'center' },
  body: { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  btn: { alignSelf: 'stretch', marginTop: spacing.xl, marginBottom: spacing.sm },
});
