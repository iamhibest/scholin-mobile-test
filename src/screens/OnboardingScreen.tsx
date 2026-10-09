import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuthHeader, Button, Card, Icon, Screen } from '../components';
import { IconName } from '../components/Icon';
import { colors, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';

type Choice = { title: string; body: string; icon: IconName; tint: string; color: string; route: string };

const choices: Choice[] = [
  { title: 'Register my school', body: "I'm the proprietor or principal setting this up for the first time.", icon: 'school', tint: colors.primarySoft, color: colors.primary, route: 'RegisterSchool' },
  { title: 'Join a school', body: "My school already uses Scholin and I'm a teacher there.", icon: 'userPlus', tint: colors.successSoft, color: colors.success, route: 'JoinSchool' },
];

type Pending = { id: string; schoolName: string };

export default function OnboardingScreen({ navigation }: any) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState('');

  // Lists the requests still waiting, and moves straight into the app when any of them is approved.
  const loadPending = useCallback(async (manual?: boolean) => {
    if (manual) {
      setChecking(true);
      setNote('');
    }
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        return;
      }
      const { data: active } = await supabase.from('school_members').select('id').eq('profile_id', uid).eq('is_active', true).limit(1);
      if (active && active.length > 0) {
        navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        return;
      }
      const { data } = await supabase.from('school_members').select('id, schools(name)').eq('profile_id', uid).eq('is_active', false);
      setPending((data || []).map((m: any) => ({ id: m.id, schoolName: (m.schools && m.schools.name) || 'a school' })));
      if (manual) {
        setNote('Not approved yet. Check again in a little while.');
      }
    } finally {
      setChecking(false);
    }
  }, [navigation]);

  useEffect(() => {
    loadPending();
    return navigation.addListener('focus', () => loadPending());
  }, [loadPending, navigation]);

  async function signOut() {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  return (
    <Screen scroll background={colors.surface}>
      <View style={styles.top}>
        <Button title="Sign out" variant="soft" onPress={signOut} style={styles.out} />
      </View>
      <AuthHeader title="One more step" subtitle="Are you setting up a new school, or joining one that's already on Scholin?" />
      {pending.length > 0 ? (
        <Card style={styles.pending}>
          <Text style={[text.bodyStrong, { color: colors.text }]}>Waiting for approval</Text>
          {pending.map(p => (
            <Text key={p.id} style={[text.body, { color: colors.textMuted, marginTop: 4 }]}>{'Your request to ' + p.schoolName + ' is waiting for the school admin.'}</Text>
          ))}
          <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.sm }]}>You do not have to wait. You can join another school or register your own below.</Text>
          {note ? <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.sm }]}>{note}</Text> : null}
          <Button title="Check again" variant="outline" onPress={() => loadPending(true)} loading={checking} style={{ marginTop: spacing.md }} />
        </Card>
      ) : null}
      <View style={{ gap: spacing.lg }}>
        {choices.map(c => (
          <Card key={c.route} onPress={() => navigation.navigate(c.route)} style={styles.card}>
            <View style={[styles.chip, { backgroundColor: c.tint }]}>
              <Icon name={c.icon} size={26} color={c.color} />
            </View>
            <Text style={[text.h3, { color: colors.text, marginTop: spacing.md }]}>{c.title}</Text>
            <Text style={[text.body, { color: colors.textMuted, marginTop: 4 }]}>{c.body}</Text>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'flex-end' },
  out: { height: 40, paddingHorizontal: 16 },
  pending: { borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  card: { borderWidth: 1, borderColor: colors.border },
  chip: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
