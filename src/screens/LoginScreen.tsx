import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthHeader, Button, Icon, Input, Notice, Screen } from '../components';
import { useChain } from '../lib/useChain';
import { colors, radius, shadow, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { recordTerms, resolveDestination } from '../lib/session';

export default function LoginScreen({ navigation }: any) {
  const chain = useChain(2);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function signIn() {
    setError('');
    setLoading(true);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out after 15 seconds. Check your internet connection.')), 15000),
      );
      const { data, error: authError } = (await Promise.race([
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        timeout,
      ])) as any;
      if (authError) {
        setError(authError.message || 'Could not sign in. Check your email and password.');
        return;
      }
      await recordTerms();
      const dest = await resolveDestination(data.user.id);
      navigation.reset({ index: 0, routes: [{ name: dest }] });
    } catch (e: any) {
      logger.error('Sign in failed: ' + e.message);
      setError('Error: ' + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll background={colors.surface}>
      <View style={styles.corner}>
        <Pressable onPress={() => navigation.navigate('ParentLogin')} style={[styles.pill, shadow.soft]}>
          <Icon name="user" size={16} color={colors.primary} />
          <Text style={[text.caption, { color: colors.primary }]}>Parent portal</Text>
        </Pressable>
      </View>

      <AuthHeader title="Welcome back" subtitle="Sign in to your school's dashboard." />
      <Notice message={error} />

      <Input {...chain(0)} label="Email address" icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
      <Input {...chain(1)} label="Password" icon="lock" secure value={password} onChangeText={setPassword} autoComplete="password" placeholder="Your password" />

      <Button title="Sign in" onPress={signIn} loading={loading} disabled={!email.trim() || !password} />

      <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.link} hitSlop={8}>
        <Text style={[text.bodyStrong, { color: colors.primary }]}>Forgot your password?</Text>
      </Pressable>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={[text.small, { color: colors.textMuted }]}>New to Scholin?</Text>
        <View style={styles.line} />
      </View>
      <Button title="Create an account" variant="outline" onPress={() => navigation.navigate('Register')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  corner: { alignItems: 'flex-end' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primaryLight },
  link: { alignItems: 'center', marginTop: spacing.xl },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
