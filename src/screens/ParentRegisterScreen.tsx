import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AuthHeader, Button, Checkbox, Input, Notice, Screen, SelectField } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { isValidEmail, recordTerms } from '../lib/session';
import { saveLastDestination } from '../lib/storage';

const titles = ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Prof', 'Engr', 'Chief', 'Alhaji', 'Alhaja', 'Rev', 'Pastor'];

export default function ParentRegisterScreen({ navigation }: any) {
  const [title, setTitle] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  async function submit() {
    setMsg('');
    setOk(false);
    const mail = email.trim();
    const inviteCode = code.trim().toUpperCase();
    if (!title) {
      setMsg('Please select a title so we know how to address you.');
      return;
    }
    if (!fullName.trim() || !mail || !phone.trim() || password.length < 6) {
      setMsg('Fill in every field. Your password needs at least 6 characters.');
      return;
    }
    if (!isValidEmail(mail)) {
      setMsg('Please enter a valid email address, for example name@example.com.');
      return;
    }
    if (!terms) {
      setMsg('Please read and agree to the Terms and Conditions to continue.');
      return;
    }
    if (!inviteCode) {
      setMsg("Please enter your child's invite code.");
      return;
    }
    setLoading(true);
    try {
      const { data: codeRow, error: codeError } = await supabase
        .from('student_invite_codes')
        .select('id, student_id, uses_remaining')
        .eq('code', inviteCode)
        .eq('is_active', true)
        .maybeSingle();
      if (codeError || !codeRow) {
        setMsg('That invite code was not recognized. Please check it and try again, or contact the school for a new one.');
        return;
      }
      if (codeRow.uses_remaining <= 0) {
        setMsg('This invite code has reached its limit of linked accounts. Please contact the school for a new code.');
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: { data: { full_name: fullName.trim(), phone: phone.trim(), title } },
      });
      if (error) {
        setMsg(error.message || 'Could not create account.');
        return;
      }
      const userId = data.user ? data.user.id : null;
      if (userId) {
        await supabase.from('profiles').insert({ id: userId, full_name: fullName.trim(), email: mail, phone: phone.trim(), title });
      }
      if (data.session && userId) {
        await recordTerms();
        const { error: linkError } = await supabase
          .from('parent_student_links')
          .insert({ parent_id: userId, student_id: codeRow.student_id, linked_via: 'invite_code' });
        if (!linkError) {
          await supabase.from('student_invite_codes').update({ uses_remaining: codeRow.uses_remaining - 1 }).eq('id', codeRow.id);
        }
        await saveLastDestination('ParentHome');
        navigation.reset({ index: 0, routes: [{ name: 'ParentHome' }] });
      } else {
        setOk(true);
        setMsg('Account created. Please check your email to confirm, then sign in to link your child.');
        setTimeout(() => navigation.reset({ index: 0, routes: [{ name: 'ParentLogin' }] }), 2500);
      }
    } catch (e: any) {
      logger.error('Parent registration failed: ' + e.message);
      setMsg('Something went wrong while creating your account. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen scroll background={colors.surface}>
      <AuthHeader title="Create your parent account" subtitle="Use the invite code your child's school gave you to link your account to your child." />
      <Notice message={msg} tone={ok ? 'success' : 'error'} />

      <SelectField label="Title" value={title} options={titles} placeholder="Select a title" hint="How would you like Scholin to address you?" onChange={setTitle} />
      <Input label="Full name" icon="user" value={fullName} onChangeText={setFullName} autoComplete="name" placeholder="e.g. Adaeze Balogun" />
      <Input label="Email address" icon="mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
      <Input label="Phone number" icon="phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="e.g. 08012345678" />
      <Input label="Password" icon="lock" secure value={password} onChangeText={setPassword} autoComplete="new-password" placeholder="At least 6 characters" />

      <View style={styles.codeWrap}>
        <Text style={[text.caption, styles.label]}>Child's invite code</Text>
        <TextInput
          value={code}
          onChangeText={v => setCode(v.toUpperCase())}
          maxLength={6}
          autoCapitalize="characters"
          placeholder="e.g. A3F7K9"
          placeholderTextColor="#9CA3AF"
          style={styles.code}
        />
        <Text style={[text.small, styles.hint]}>
          Get this code from your child's school. If you have more than one child at the school, you can link additional children after signing in.
        </Text>
      </View>

      <Checkbox checked={terms} onChange={setTerms}>
        <Text style={[text.small, { color: colors.text }]}>
          I have read and agree to the{' '}
          <Text style={{ color: colors.primary }} onPress={() => navigation.navigate('Terms')}>Terms and Conditions</Text>
        </Text>
      </Checkbox>

      <Button title="Create account" onPress={submit} loading={loading} />

      <View style={styles.footer}>
        <Text style={[text.body, { color: colors.textMuted }]}>Already have an account? </Text>
        <Pressable onPress={() => navigation.navigate('ParentLogin')} hitSlop={8}>
          <Text style={[text.bodyStrong, { color: colors.primary }]}>Sign in</Text>
        </Pressable>
      </View>
      <View style={styles.footer}>
        <Text style={[text.small, { color: colors.textMuted }]}>Are you a teacher or school admin? </Text>
        <Pressable onPress={() => navigation.navigate('Register')} hitSlop={8}>
          <Text style={[text.small, { color: colors.primary, fontFamily: fonts.semibold }]}>Create a staff account instead</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeWrap: { marginBottom: spacing.lg },
  label: { color: colors.textMuted, marginBottom: 6, letterSpacing: 0.3 },
  code: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 54, fontFamily: 'monospace', fontSize: 18, letterSpacing: 3, color: colors.text },
  hint: { color: colors.textMuted, marginTop: 6 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: spacing.lg },
});
