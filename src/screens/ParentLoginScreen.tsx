import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthHeader, Button, Input, Notice, Screen } from '../components';
import { colors, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { recordTerms } from '../lib/session';
import { saveLastDestination } from '../lib/storage';

export default function ParentLoginScreen({ navigation }: any) {
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
      const { error: authError } = (await Promise.race([
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        timeout,
      ])) as any;
      if (authError) {
        setError(authError.message || 'Could not sign in. Check your email and password.');
        return;
      }
      await recordTerms();
      await saveLastDestination('ParentHome');
      navigation.reset({ index: 0, routes: [{ name: 'ParentHome' }] });
    } catch (e: any) {
      logger.error('Parent sign in failed: ' + e.message);
      setError('Error. ' + (e.message || String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll background={colors.surface}>
      <AuthHeader title="Parent portal" subtitle="Sign in to see your child's attendance, results, fees, and school announcements." />
      <Notice message={error} />

      <Input label="Email address" icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
      <Input label="Password" icon="lock" secure value={password} onChangeText={setPassword} autoComplete="password" placeholder="Your password" />

      <Button title="Sign in" onPress={signIn} loading={loading} disabled={!email.trim() || !password} />

      <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.link} hitSlop={8}>
        <Text style={[text.bodyStrong, { color: colors.primary }]}>Forgot your password?</Text>
      </Pressable>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={[text.small, { color: colors.textMuted }]}>New to Scholin?</Text>
        <View style={styles.line} />
      </View>
      <Button title="Create a parent account" variant="outline" onPress={() => navigation.navigate('ParentRegister')} />

      <View style={styles.footer}>
        <Text style={[text.small, { color: colors.textMuted }]}>Are you a teacher or school admin? </Text>
        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
          <Text style={[text.small, { color: colors.primary, fontFamily: 'Inter_600SemiBold' }]}>Sign in here instead</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { alignItems: 'center', marginTop: spacing.xl },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.xl },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.xl },
});
