import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Button, Input, Screen } from '../components';
import { colors, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function signIn() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (authError) {
      logger.error('Sign in failed: ' + authError.message);
      setError(authError.message);
      return;
    }
    logger.info('Signed in');
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }

  return (
    <Screen scroll background={colors.surface}>
      <View style={styles.head}>
        <Image source={require('../assets/images/emblem.png')} style={styles.emblem} resizeMode="contain" />
        <Text style={[text.h1, styles.title]}>Welcome back</Text>
        <Text style={[text.body, styles.sub]}>Sign in to continue to your school.</Text>
      </View>

      <Input label="Email" icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@school.com" />
      <Input label="Password" icon="lock" secure value={password} onChangeText={setPassword} placeholder="Your password" />

      {error ? <Text style={[text.small, styles.error]}>{error}</Text> : null}

      <Button title="Sign in" onPress={signIn} loading={loading} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginVertical: spacing.xxl },
  emblem: { width: 84, height: 88 },
  title: { color: colors.primary, marginTop: spacing.lg },
  sub: { color: colors.textMuted, marginTop: spacing.xs },
  error: { color: colors.danger, marginBottom: spacing.md },
});
