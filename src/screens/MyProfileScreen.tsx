import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Input, Notice, PhotoField, Screen, ShineButton, Skeleton } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { fetchMyProfile, saveMyProfile } from '../lib/account';

export default function MyProfileScreen() {
  const [userId, setUserId] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState('');
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwNotice, setPwNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data.session?.user?.id;
        if (!uid) {
          return;
        }
        setUserId(uid);
        const p = await fetchMyProfile(uid);
        setName(p.full_name || '');
        setPhone(p.phone || '');
        setEmail(p.email || data.session?.user?.email || '');
        setPhoto(p.avatar_url || '');
      } catch (e: any) {
        setNotice({ message: e.message, tone: 'error' });
      }
      setLoaded(true);
    })();
  }, []);

  const save = async () => {
    setNotice({ message: '', tone: 'success' });
    if (!name.trim()) {
      setNotice({ message: 'Name cannot be empty.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await saveMyProfile(userId, name.trim(), phone.trim(), photo || null);
      setNotice({ message: 'Your profile has been saved.', tone: 'success' });
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy(false);
  };

  const changePassword = async () => {
    setPwNotice({ message: '', tone: 'success' });
    if (next.length < 6) {
      setPwNotice({ message: 'Your new password must be at least 6 characters.', tone: 'error' });
      return;
    }
    if (next !== again) {
      setPwNotice({ message: 'The new passwords do not match.', tone: 'error' });
      return;
    }
    if (next === current) {
      setPwNotice({ message: 'Choose a password that is different from your current one.', tone: 'error' });
      return;
    }
    setPwBusy(true);
    try {
      // Checking the current password first means a borrowed or left open phone cannot quietly change it.
      const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: current });
      if (checkError) {
        setPwNotice({ message: 'Your current password is not correct.', tone: 'error' });
      } else {
        const { error } = await supabase.auth.updateUser({ password: next });
        if (error) {
          setPwNotice({ message: error.message || 'Could not change your password.', tone: 'error' });
        } else {
          setCurrent('');
          setNext('');
          setAgain('');
          setPwNotice({ message: 'Your password has been changed.', tone: 'success' });
        }
      }
    } catch (e: any) {
      setPwNotice({ message: e && e.message ? e.message : 'Could not change your password.', tone: 'error' });
    }
    setPwBusy(false);
  };

  if (!loaded) {
    return (
      <Screen>
        <Skeleton height={130} radius={24} />
        <Skeleton height={260} radius={20} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Notice message={notice.message} tone={notice.tone} />
        <View style={styles.card}>
          <PhotoField name={name || 'You'} url={photo} schoolId={null} onChange={setPhoto} label="profile photo" />
        </View>
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <Input label="Full name" value={name} onChangeText={setName} icon="user" />
          <Input label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" icon="phone" />
          <Input label="Email address" value={email} editable={false} icon="mail" />
          <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>Your email is your sign in and cannot be changed here.</Text>
          <ShineButton title="Save changes" loading={busy} onPress={save} />
        </View>
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <Text style={[text.h3, { color: colors.text }]}>Change password</Text>
          <Text style={[text.small, { color: colors.textMuted, marginTop: 2, marginBottom: spacing.md }]}>Enter your current password, then choose a new one.</Text>
          <Notice message={pwNotice.message} tone={pwNotice.tone} />
          <Input label="Current password" icon="lock" secure value={current} onChangeText={setCurrent} autoComplete="current-password" placeholder="Your current password" />
          <Input label="New password" icon="lock" secure value={next} onChangeText={setNext} autoComplete="new-password" placeholder="At least 6 characters" />
          <Input label="Confirm new password" icon="lock" secure value={again} onChangeText={setAgain} autoComplete="new-password" placeholder="Re-enter new password" />
          <Button title="Change password" variant="outline" loading={pwBusy} disabled={!current || !next || !again} onPress={changePassword} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: '#EEF1F6' },
});
