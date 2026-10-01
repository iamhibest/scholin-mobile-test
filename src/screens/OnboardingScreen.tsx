import React from 'react';
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

export default function OnboardingScreen({ navigation }: any) {
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
  card: { borderWidth: 1, borderColor: colors.border },
  chip: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
