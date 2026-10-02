import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BottomSheet, Button, Card, Icon, Screen, Skeleton } from '../components';
import { IconName } from '../components/Icon';
import { toneColors } from '../components/QuickTile';
import { colors, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { showError } from '../lib/confirm';
import { classLabel, fetchClass, fetchSchoolTeachers, SchoolClass, setClassTeacher } from '../lib/school';

type Tile = { key: string; title: string; desc: string; icon: IconName; tone: keyof typeof toneColors; allowed: boolean; note: string; go: () => void };

export default function ClassWorkspaceScreen({ navigation, route }: any) {
  const p = route.params;
  const { classId, sessionId, sessionName, termId, termName } = p;
  const { ctx } = useStaff();
  const [cls, setCls] = useState<SchoolClass | null>(null);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [pick, setPick] = useState('');
  const [sheet, setSheet] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const c = await fetchClass(classId);
      setCls(c);
      setPick((c as any).class_teacher_id || '');
      navigation.setOptions({ title: classLabel(c) });
    } catch (e: any) {
      showError(e.message);
    }
  }, [classId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!cls || !ctx) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={86} radius={24} />
          <Skeleton height={86} radius={24} />
          <Skeleton height={86} radius={24} />
        </View>
      </Screen>
    );
  }

  const name = classLabel(cls);
  const m = ctx.membership;
  const admin = ctx.isAdmin;
  const canResults = admin || m.can_edit_results === true;
  const canReport = admin || m.can_generate_report_cards === true;
  const canComments = admin || m.can_add_comments === true;
  const canRegister = admin || m.can_mark_attendance === true;
  const base = { classId, sessionId, sessionName, termId, termName, className: name };
  const needsPermission = 'Requires permission';
  const adminOnly = 'Admins only';

  const tiles: Tile[] = [
    { key: 'results', title: 'Edit / Add Results', desc: 'Enter scores per subject and assessment component.', icon: 'file', tone: 'blue', allowed: canResults, note: needsPermission, go: () => navigation.navigate('ClassResults', base) },
    { key: 'cards', title: 'Generate Report Cards', desc: 'Preview and generate report cards for this class.', icon: 'fileCheck', tone: 'green', allowed: canReport, note: needsPermission, go: () => navigation.navigate('ClassReportCards', base) },
    { key: 'comments', title: 'Comments and Ratings', desc: 'Add remarks, cognitive skills, character and conduct ratings.', icon: 'chat', tone: 'amber', allowed: canComments, note: needsPermission, go: () => navigation.navigate('ClassComments', base) },
    { key: 'register', title: 'Register', desc: 'Mark daily attendance and view the weekly attendance sheet.', icon: 'clipboard', tone: 'teal', allowed: canRegister, note: needsPermission, go: () => navigation.navigate('ClassAttendance', base) },
    { key: 'subjects', title: 'Class Subjects', desc: 'Choose which subjects apply to this class.', icon: 'book', tone: 'purple', allowed: canResults, note: needsPermission, go: () => navigation.navigate('ClassSubjects', base) },
    { key: 'arrange', title: 'Arrange Subjects', desc: "Set the order subjects appear in on this class's report card.", icon: 'layers', tone: 'blue', allowed: canResults, note: needsPermission, go: () => navigation.navigate('ArrangeSubjects', base) },
    {
      key: 'teacher',
      title: 'Change Class Teacher',
      desc: "Assign or reassign this class's homeroom teacher.",
      icon: 'user',
      tone: 'rose',
      allowed: admin,
      note: adminOnly,
      go: async () => {
        setSheet(true);
        try {
          setTeachers(await fetchSchoolTeachers(ctx.schoolId));
        } catch (e: any) {
          showError(e.message);
        }
      },
    },
    { key: 'remove', title: 'Remove Student from Exam', desc: "Exclude a student from this term's assessment.", icon: 'close', tone: 'rose', allowed: admin, note: adminOnly, go: () => navigation.navigate('RemoveFromExam', base) },
    { key: 'publish', title: 'Publish Report Cards to Parents', desc: "Release this class's report cards for a term, once checked.", icon: 'send', tone: 'teal', allowed: admin, note: adminOnly, go: () => navigation.navigate('PublishReports', base) },
    { key: 'settings', title: 'Class Settings', desc: 'Rename, adjust arm, or delete this class.', icon: 'settings', tone: 'gold', allowed: admin, note: adminOnly, go: () => navigation.navigate('ClassSettings', { ...base, arm: cls.arm || '', rawName: cls.name }) },
  ];

  const saveTeacher = async () => {
    if (!pick) {
      showError('Please select a teacher.');
      return;
    }
    setSaving(true);
    try {
      await setClassTeacher(classId, pick);
      await load();
      setSheet(false);
    } catch (e: any) {
      showError(e.message);
    }
    setSaving(false);
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Text style={[text.h1, { color: colors.primary }]}>{name}</Text>
          <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>{termName + '  |  ' + sessionName}</Text>
          <View style={styles.teacher}>
            <Icon name="user" size={16} color={colors.textMuted} />
            <Text style={[text.small, { color: colors.textMuted }]}>{'Class teacher: ' + (cls.class_teacher ? cls.class_teacher.full_name : 'Not assigned')}</Text>
          </View>
        </View>

        {tiles.map(t => {
          const c = toneColors[t.tone];
          return (
            <Card key={t.key} onPress={t.allowed ? t.go : undefined} style={[styles.tile, !t.allowed && { opacity: 0.55 }]}>
              <View style={styles.row}>
                <View style={[styles.chip, { backgroundColor: c.bg }]}>
                  <Icon name={t.icon} size={22} color={c.fg} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyStrong, { color: colors.text }]}>{t.title}</Text>
                  <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={2}>{t.allowed ? t.desc : t.note}</Text>
                </View>
                <Icon name={t.allowed ? 'chevron' : 'lock'} size={t.allowed ? 20 : 18} color={colors.textMuted} />
              </View>
            </Card>
          );
        })}
      </ScrollView>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Class teacher">
        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {teachers.map(t => {
            const on = t.id === pick;
            return (
              <Pressable key={t.id} onPress={() => setPick(t.id)} style={[styles.option, on && { backgroundColor: colors.primarySoft }]}>
                <Text style={[text.body, { flex: 1, color: on ? colors.primary : colors.text }]}>{t.name}</Text>
                {on ? <Icon name="check" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
        <Button title="Save class teacher" loading={saving} disabled={!pick} onPress={saveTeacher} style={{ marginTop: spacing.lg }} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  head: { marginBottom: spacing.lg },
  teacher: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  tile: { marginBottom: spacing.md, padding: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chip: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.md, borderRadius: radius.md },
});
