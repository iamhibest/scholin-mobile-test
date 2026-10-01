import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Input, Notice, OptionField, Screen, Skeleton } from '../components';
import { spacing } from '../theme';
import { useStaff } from '../lib/useStaff';
import { displayToIso, isoToDisplay, maskDate } from '../lib/date';
import { classLabel, createStudent, fetchClasses, fetchStudent, SchoolClass, updateStudent } from '../lib/school';

export default function StudentFormScreen({ navigation, route }: any) {
  const { studentId, sessionId } = route.params || {};
  const editing = !!studentId;
  const { ctx } = useStaff();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [name, setName] = useState('');
  const [admission, setAdmission] = useState('');
  const [gender, setGender] = useState('');
  const [dob, setDob] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [classId, setClassId] = useState('');
  const [ready, setReady] = useState(!editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Edit student' : 'Add student' });
  }, [navigation, editing]);

  useEffect(() => {
    if (sessionId && !editing) {
      fetchClasses(sessionId).then(setClasses).catch(() => setClasses([]));
    }
  }, [sessionId, editing]);

  useEffect(() => {
    if (!editing) {
      return;
    }
    fetchStudent(studentId)
      .then(s => {
        setName(s.full_name || '');
        setAdmission(s.admission_no || '');
        setGender(s.gender || '');
        setDob(isoToDisplay(s.dob));
        setParentName(s.parent_name || '');
        setParentPhone(s.parent_phone || '');
        setReady(true);
      })
      .catch(e => {
        setError(e.message);
        setReady(true);
      });
  }, [editing, studentId]);

  const lockAdmission = !editing && !!ctx && ctx.autoAdmission;

  const save = async () => {
    setError('');
    if (!name.trim()) {
      setError('Full name is required.');
      return;
    }
    const iso = displayToIso(dob);
    if (iso === undefined) {
      setError('Enter the date of birth as DD/MM/YYYY.');
      return;
    }
    const form = { full_name: name, admission_no: admission, gender, dob: iso || '', parent_name: parentName, parent_phone: parentPhone };
    setSaving(true);
    try {
      if (editing) {
        await updateStudent(studentId, form);
      } else if (ctx) {
        await createStudent(ctx, form, sessionId, classId);
      }
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={54} radius={12} />
          <Skeleton height={54} radius={12} />
          <Skeleton height={54} radius={12} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Notice message={error} />
      <Input label="Full name" value={name} onChangeText={setName} placeholder="e.g. Oluwadamilola Michael" icon="user" autoCapitalize="words" />
      <Input
        label="Admission number"
        value={admission}
        onChangeText={setAdmission}
        placeholder={lockAdmission ? 'Generated automatically on save' : 'e.g. RBS/20/0456'}
        editable={!lockAdmission}
        autoCapitalize="characters"
      />
      <OptionField
        label="Gender"
        value={gender}
        options={[{ value: '', label: 'Not specified' }, { value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]}
        placeholder="Select gender"
        onChange={setGender}
      />
      <Input label="Date of birth" value={dob} onChangeText={t => setDob(maskDate(t))} placeholder="DD/MM/YYYY" icon="calendar" keyboardType="number-pad" maxLength={10} />
      <Input label="Parent or guardian name" value={parentName} onChangeText={setParentName} icon="user" autoCapitalize="words" />
      <Input label="Parent or guardian phone" value={parentPhone} onChangeText={setParentPhone} icon="phone" keyboardType="phone-pad" />
      {!editing ? (
        <OptionField
          label="Assign to class this session"
          value={classId}
          options={[{ value: '', label: 'Not assigned yet' }, ...classes.map(c => ({ value: c.id, label: classLabel(c) }))]}
          placeholder="Not assigned yet"
          onChange={setClassId}
        />
      ) : null}
      <Button title={editing ? 'Save changes' : 'Add student'} loading={saving} onPress={save} style={styles.save} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  save: { marginTop: spacing.md, marginBottom: spacing.xl },
});
