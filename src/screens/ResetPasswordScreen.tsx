import React, { useState } from 'react';
import { AuthHeader, Button, Input, Notice, Screen } from '../components';
import { useChain } from '../lib/useChain';
import { colors } from '../theme';
import { supabase } from '../lib/supabase';

export default function ResetPasswordScreen({ navigation }: any) {
  const chain = useChain(2);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  async function submit() {
    setMsg('');
    setOk(false);
    if (password.length < 6) {
      setMsg('Your password needs at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setMsg('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMsg(error.message || 'Could not update password. The reset link may have expired. Request a new one.');
      return;
    }
    setOk(true);
    setMsg('Password updated! Redirecting to sign in.');
    await supabase.auth.signOut();
    setTimeout(() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }), 2000);
  }

  return (
    <Screen scroll background={colors.surface}>
      <AuthHeader title="Set a new password" subtitle="Choose a new password for your account." />
      <Notice message={msg} tone={ok ? 'success' : 'error'} />
      <Input {...chain(0)} label="New password" icon="lock" secure value={password} onChangeText={setPassword} autoComplete="new-password" placeholder="At least 6 characters" />
      <Input {...chain(1)} label="Confirm new password" icon="lock" secure value={confirm} onChangeText={setConfirm} autoComplete="new-password" placeholder="Re-enter password" />
      <Button title="Update password" onPress={submit} loading={loading} disabled={!password || !confirm} />
    </Screen>
  );
}
