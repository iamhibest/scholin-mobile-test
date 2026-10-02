import React, { useEffect, useState } from 'react';
import { Button, Input, Notice, Screen } from '../components';
import { useChain } from '../lib/useChain';
import { spacing } from '../theme';
import { useStaff } from '../lib/useStaff';
import { createClass, updateClass } from '../lib/school';

export default function ClassFormScreen({ navigation, route }: any) {
  const chain = useChain(2);
  const { sessionId, classId, name: initialName, arm: initialArm } = route.params;
  const editing = !!classId;
  const { ctx } = useStaff();
  const [name, setName] = useState(initialName || '');
  const [arm, setArm] = useState(initialArm || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Class settings' : 'Add class' });
  }, [navigation, editing]);

  const save = async () => {
    setError('');
    if (!name.trim()) {
      setError('Class name is required.');
      return;
    }
    if (!editing && !ctx) {
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateClass(classId, name.trim(), arm.trim());
      } else if (ctx) {
        await createClass(ctx.schoolId, sessionId, name.trim(), arm.trim());
      }
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <Notice message={error} />
      <Input {...chain(0)} label="Class name" value={name} onChangeText={setName} placeholder="e.g. Primary 4" icon="cap" autoCapitalize="words" />
      <Input {...chain(1)} label="Arm (optional)" value={arm} onChangeText={setArm} placeholder="e.g. A" autoCapitalize="characters" />
      <Button title={editing ? 'Save changes' : 'Add class'} loading={saving} onPress={save} style={{ marginTop: spacing.md }} />
    </Screen>
  );
}
