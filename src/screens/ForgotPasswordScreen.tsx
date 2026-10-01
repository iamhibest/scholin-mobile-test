import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthHeader, Button, Input, Notice, Screen } from '../components';
import { colors, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { env } from '../config/env';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  async function send() {
    setMsg('');
    setOk(false);
    setLoading(true);
    const options = env.webBaseUrl ? { redirectTo: env.webBaseUrl + '/reset-password.html' } : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), options);
    setLoading(false);
    if (error) {
      setMsg(error.message || 'Could not send reset link.');
      return;
    }
    setOk(true);
    setMsg('If an account exists with that email, a reset link has been sent. Check your inbox (and spam folder).');
    setEmail('');
  }

  return (
    <Screen scroll background={colors.surface}>
      <AuthHeader title="Reset your password" subtitle="Enter the email address you signed up with. We'll send you a link to reset your password." />
      <Notice message={msg} tone={ok ? 'success' : 'error'} />
      <Input label="Email address" icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
      <Button title="Send reset link" onPress={send} loading={loading} disabled={!email.trim()} />
      <View style={styles.footer}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={[text.bodyStrong, { color: colors.primary }]}>Back to sign in</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { alignItems: 'center', marginTop: spacing.xl },
});
