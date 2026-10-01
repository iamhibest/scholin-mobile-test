import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthHeader, Button, Checkbox, Input, Notice, Screen } from '../components';
import { colors, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { isValidEmail, recordTerms } from '../lib/session';

export default function RegisterScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  async function submit() {
    setMsg('');
    setOk(false);
    const mail = email.trim();
    if (!fullName.trim() || !mail || !phone.trim() || password.length < 6) {
      setMsg('Fill in every field. Your password needs at least 6 characters.');
      return;
    }
    if (!isValidEmail(mail)) {
      setMsg('Please enter a valid email address (e.g. name@example.com).');
      return;
    }
    if (!terms) {
      setMsg('Please read and agree to the Terms and Conditions to continue.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: { data: { full_name: fullName.trim(), phone: phone.trim() } },
      });
      if (error) {
        setMsg(error.message || 'Could not create account.');
        return;
      }
      const userId = data.user?.id;
      if (userId) {
        await supabase.from('profiles').insert({ id: userId, full_name: fullName.trim(), email: mail, phone: phone.trim() });
      }
      if (data.session) {
        await recordTerms();
        navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
      } else {
        setOk(true);
        setMsg('Account created! Please check your email to confirm, then sign in.');
        setTimeout(() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }), 2500);
      }
    } catch (e: any) {
      logger.error('Register failed: ' + e.message);
      setMsg('Something went wrong. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll background={colors.surface}>
      <AuthHeader title="Create your account" subtitle="This is your personal login. You'll set up or join a school next." />
      <Notice message={msg} tone={ok ? 'success' : 'error'} />

      <Input label="Full name" icon="user" value={fullName} onChangeText={setFullName} autoComplete="name" placeholder="e.g. Adaeze Balogun" />
      <Input label="Email address" icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
      <Input label="Phone number" icon="phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="e.g. 08012345678" />
      <Input label="Password" icon="lock" secure value={password} onChangeText={setPassword} autoComplete="new-password" placeholder="At least 6 characters" />

      <Checkbox checked={terms} onChange={setTerms}>
        <Text style={[text.small, { color: colors.text }]}>
          I have read and agree to the{' '}
          <Text style={{ color: colors.primary }} onPress={() => navigation.navigate('Terms')}>Terms and Conditions</Text>
        </Text>
      </Checkbox>

      <Button title="Create account" onPress={submit} loading={loading} />

      <View style={styles.footer}>
        <Text style={[text.body, { color: colors.textMuted }]}>Already have an account? </Text>
        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8}>
          <Text style={[text.bodyStrong, { color: colors.primary }]}>Sign in</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
});
