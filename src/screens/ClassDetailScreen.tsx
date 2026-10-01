import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar, Button, Card, EmptyState, OptionField, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { showError } from '../lib/confirm';
import { classLabel, fetchClass, fetchClassRoster, fetchSchoolTeachers, SchoolClass, setClassTeacher } from '../lib/school';

export default function ClassDetailScreen({ navigation, route }: any) {
  const { classId, sessionId } = route.params;
  const { ctx } = useStaff();
  const [cls, setCls] = useState<SchoolClass | null>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const isAdmin = !!ctx && ctx.isAdmin;

  const load = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([fetchClass(classId), fetchClassRoster(classId, sessionId)]);
      setCls(c);
      setTeacherId((c as any).class_teacher_id || '');
      setRoster(r);
      navigation.setOptions({ title: classLabel(c) });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [classId, sessionId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useFocusEffect(
    useCallback(() => {
      if (ctx && ctx.isAdmin) {
        fetchSchoolTeachers(ctx.schoolId).then(setTeachers).catch(() => setTeachers([]));
      }
    }, [ctx]),
  );

  const saveTeacher = async () => {
    if (!teacherId) {
      showError('Please select a teacher.');
      return;
    }
    setSaving(true);
    try {
      await setClassTeacher(classId, teacherId);
      await load();
    } catch (e: any) {
      showError(e.message);
    }
    setSaving(false);
  };

  if (failed) {
    return (
      <Screen>
        <EmptyState icon="info" title="Could not load this class" actionLabel="Try again" onAction={load} />
      </Screen>
    );
  }

  if (!cls) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={110} radius={24} />
          <Skeleton height={200} radius={24} />
        </View>
      </Screen>
    );
  }

  const currentId = (cls as any).class_teacher_id || '';

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Card>
          <Text style={[text.caption, { color: colors.textMuted }]}>CLASS TEACHER</Text>
          <Text style={[text.h3, { color: colors.text, marginTop: 4 }]}>{cls.class_teacher ? cls.class_teacher.full_name : 'Not assigned'}</Text>
          {isAdmin ? (
            <View style={{ marginTop: spacing.lg }}>
              <OptionField label="Change class teacher" value={teacherId} options={teachers.map(t => ({ value: t.id, label: t.name }))} placeholder="Select a teacher" onChange={setTeacherId} />
              <Button title="Save class teacher" variant="soft" loading={saving} disabled={!teacherId || teacherId === currentId} onPress={saveTeacher} />
              <Button
                title="Class settings"
                icon="settings"
                variant="outline"
                style={{ marginTop: spacing.md }}
                onPress={() => navigation.navigate('ClassForm', { sessionId, classId, name: cls.name, arm: cls.arm || '' })}
              />
            </View>
          ) : null}
        </Card>

        <Text style={[text.h3, styles.heading]}>{'Students (' + roster.length + ')'}</Text>
        {roster.length === 0 ? (
          <EmptyState icon="users" title="No students in this class yet" message={isAdmin ? 'Assign students from the Students screen.' : 'Your school admin assigns students to classes.'} />
        ) : (
          <Card style={{ paddingVertical: spacing.sm }}>
            {roster.map((s, i) => (
              <View key={s.id} style={[styles.student, i > 0 && styles.divider]}>
                <Avatar name={s.full_name} uri={s.photo_url || undefined} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{s.full_name}</Text>
                  <Text style={[text.small, { color: colors.textMuted }]}>{s.admission_no || 'No admission number'}</Text>
                </View>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  heading: { color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  student: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
