import React, { useState } from 'react';
import { Button, Input, Notice, PhotoField, Screen } from '../components';
import { useChain } from '../lib/useChain';
import { useStaff } from '../lib/useStaff';
import { spacing } from '../theme';
import { saveTeacherProfile } from '../lib/school';

export default function TeacherEditScreen({ navigation, route }: any) {
  const chain = useChain(2);
  const { profileId, name: initialName, phone: initialPhone, avatar } = route.params;
  const [name, setName] = useState(initialName || '');
  const [phone, setPhone] = useState(initialPhone || '');
  const [photo, setPhoto] = useState(avatar || '');
  const { ctx } = useStaff();
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
      await saveTeacherProfile(profileId, name.trim(), phone.trim(), photo || null);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <PhotoField name={name} url={photo} schoolId={ctx ? ctx.schoolId : null} onChange={setPhoto} label="profile photo" />
      <Notice message={error} />
      <Input {...chain(0)} label="Full name" value={name} onChangeText={setName} icon="user" autoCapitalize="words" />
      <Input {...chain(1)} label="Phone number" value={phone} onChangeText={setPhone} icon="phone" keyboardType="phone-pad" />
      <Button title="Save changes" loading={saving} onPress={save} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}
