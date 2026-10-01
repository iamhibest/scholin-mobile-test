import React, { useCallback, useState } from 'react';
import { Linking, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar, Badge, Button, Card, EmptyState, Icon, OptionField, Screen, Skeleton } from '../components';
import { IconName } from '../components/Icon';
import { colors, fonts, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { confirmAction, showError } from '../lib/confirm';
import { isoToDisplay } from '../lib/date';
import { assignClass, classLabel, fetchClasses, fetchInviteCode, fetchStudent, fetchStudentClass, regenerateInviteCode, removeStudent, SchoolClass, Student } from '../lib/school';

function InfoRow({ icon, label, value, onPress }: { icon: IconName; label: string; value: string; onPress?: () => void }) {
  return (
    <View style={styles.info}>
      <View style={styles.infoChip}>
        <Icon name={icon} size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[text.caption, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[text.body, { color: onPress && value ? colors.primary : colors.text }]} onPress={value ? onPress : undefined}>{value || 'Not provided'}</Text>
      </View>
    </View>
  );
}

export default function StudentDetailScreen({ navigation, route }: any) {
  const { studentId, sessionId } = route.params;
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [invite, setInvite] = useState<{ code: string; uses: number } | null>(null);
  const [linked, setLinked] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, cls, current, code, links] = await Promise.all([
        fetchStudent(studentId),
        fetchClasses(sessionId),
        fetchStudentClass(studentId, sessionId),
        fetchInviteCode(studentId).catch(() => null),
        supabase.from('parent_student_links').select('student_id').eq('student_id', studentId).limit(1),
      ]);
      setStudent(s);
      setClasses(cls);
      setClassId(current);
      setInvite(code);
      setLinked((links.data || []).length > 0);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [studentId, sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const changeClass = async (next: string) => {
    const previous = classId;
    setClassId(next);
    try {
      await assignClass(studentId, sessionId, next);
    } catch (e: any) {
      setClassId(previous);
      showError(e.message);
    }
  };

  const regenerate = () => {
    const run = async () => {
      setBusy(true);
      try {
        await regenerateInviteCode(studentId);
        setInvite(await fetchInviteCode(studentId));
      } catch (e: any) {
        showError(e.message);
      }
      setBusy(false);
    };
    if (invite) {
      confirmAction('Regenerate code', 'The current code will stop working immediately. Parents already linked stay linked.', 'Regenerate', run, false);
    } else {
      run();
    }
  };

  const shareCode = () => {
    if (student && invite) {
      Share.share({ message: 'Use code ' + invite.code + ' to link to ' + student.full_name + ' on Scholin.' });
    }
  };

  const remove = () => {
    if (!student) {
      return;
    }
    confirmAction(
      'Remove student',
      'Permanently remove ' + student.full_name + '? This deletes all their records, results and history. This cannot be undone.',
      'Remove',
      async () => {
        try {
          await removeStudent(studentId);
          navigation.goBack();
        } catch (e: any) {
          showError(e.message);
        }
      },
    );
  };

  if (failed) {
    return (
      <Screen>
        <EmptyState icon="info" title="Could not load this student" actionLabel="Try again" onAction={load} />
      </Screen>
    );
  }

  if (!student) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={150} radius={24} />
          <Skeleton height={220} radius={24} />
        </View>
      </Screen>
    );
  }

  const classOptions = [{ value: '', label: 'Not assigned' }, ...classes.map(c => ({ value: c.id, label: classLabel(c) }))];

  return (
    <Screen scroll>
      <Card style={styles.hero}>
        <Avatar name={student.full_name} uri={student.photo_url || undefined} size={84} />
        <Text style={[text.h2, styles.name]}>{student.full_name}</Text>
        <Text style={[text.body, { color: colors.textMuted }]}>{student.admission_no || 'No admission number'}</Text>
        <View style={styles.tags}>
          {student.gender ? <Badge label={student.gender} tone="blue" /> : null}
          <Badge label={linked ? 'Parent linked' : 'No parent linked'} tone={linked ? 'green' : 'orange'} />
        </View>
      </Card>

      <Card style={styles.block}>
        <OptionField label="Class this session" value={classId} options={classOptions} onChange={changeClass} hint="Changes save as soon as you pick a class." />
        <InfoRow icon="calendar" label="Date of birth" value={isoToDisplay(student.dob)} />
        <InfoRow icon="user" label="Parent or guardian" value={student.parent_name || ''} />
        <InfoRow icon="phone" label="Parent or guardian phone" value={student.parent_phone || ''} onPress={() => Linking.openURL('tel:' + student.parent_phone)} />
      </Card>

      <Card style={styles.block}>
        <Text style={[text.h3, { color: colors.text }]}>Parent invite code</Text>
        <Text style={[text.small, styles.muted]}>Parents use this code to link their account to this student.</Text>
        {invite ? (
          <View style={styles.codeBox}>
            <Text style={styles.code}>{invite.code}</Text>
            <Text style={[text.small, styles.muted]}>{invite.uses + ' of 4 uses left'}</Text>
          </View>
        ) : (
          <Text style={[text.body, styles.muted, { marginTop: spacing.md }]}>No code yet. Tap Generate code to create one.</Text>
        )}
        <View style={styles.actions}>
          {invite ? <Button title="Share" icon="arrowRight" variant="soft" onPress={shareCode} style={{ flex: 1 }} /> : null}
          <Button title={invite ? 'Regenerate' : 'Generate code'} variant="outline" loading={busy} onPress={regenerate} style={{ flex: 1 }} />
        </View>
      </Card>

      <Button title="Edit student" onPress={() => navigation.navigate('StudentForm', { studentId, sessionId })} style={{ marginTop: spacing.lg }} />
      <Button title="Remove student" variant="danger" onPress={remove} style={{ marginTop: spacing.md, marginBottom: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: spacing.xl },
  name: { color: colors.text, marginTop: spacing.md, textAlign: 'center' },
  tags: { flexDirection: 'row', gap: 8, marginTop: spacing.md },
  block: { marginTop: spacing.lg },
  info: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  infoChip: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.textMuted, marginTop: 4 },
  codeBox: { marginTop: spacing.md, backgroundColor: colors.primarySoft, borderRadius: 16, paddingVertical: spacing.lg, alignItems: 'center' },
  code: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: 6, color: colors.primary },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
