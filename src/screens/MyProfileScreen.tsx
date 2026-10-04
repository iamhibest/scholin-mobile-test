import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Input, Notice, PhotoField, Screen, ShineButton, Skeleton } from '../components';
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: '#EEF1F6' },
});
