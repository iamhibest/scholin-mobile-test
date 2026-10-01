import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Avatar, Button, Input, Notice, Screen } from '../components';
import { spacing } from '../theme';
import { saveTeacherProfile } from '../lib/school';

export default function TeacherEditScreen({ navigation, route }: any) {
  const { profileId, name: initialName, phone: initialPhone, avatar } = route.params;
  const [name, setName] = useState(initialName || '');
  const [phone, setPhone] = useState(initialPhone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    setSaving(true);
    try {
      await saveTeacherProfile(profileId, name.trim(), phone.trim(), avatar || null);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.avatar}>
        <Avatar name={name} uri={avatar || undefined} size={96} />
      </View>
      <Notice message={error} />
      <Input label="Full name" value={name} onChangeText={setName} icon="user" autoCapitalize="words" />
      <Input label="Phone number" value={phone} onChangeText={setPhone} icon="phone" keyboardType="phone-pad" />
      <Button title="Save changes" loading={saving} onPress={save} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', marginBottom: spacing.xl },
});
