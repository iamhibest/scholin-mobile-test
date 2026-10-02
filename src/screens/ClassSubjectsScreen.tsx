import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View, FlatList } from 'react-native';
import { EmptyState, OptionField, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { showError } from '../lib/confirm';
import { classLabel, fetchClasses, fetchSessions, SchoolClass } from '../lib/school';
import { fetchAssignedSubjectIds, fetchSchoolSubjects, toggleClassSubject } from '../lib/portal';

export default function ClassSubjectsScreen({ navigation, route }: any) {
  const { classId: startClass, sessionId: startSession } = route.params;
  const { ctx } = useStaff();
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState(startSession);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState(startClass);
  const [subjects, setSubjects] = useState<any[] | null>(null);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());

  useEffect(() => {
    navigation.setOptions({ title: 'Class Subjects' });
  }, [navigation]);

  useEffect(() => {
    if (ctx) {
      fetchSessions(ctx.schoolId).then(setSessions).catch(() => {});
      fetchSchoolSubjects(ctx.schoolId).then(setSubjects).catch(e => {
        setSubjects([]);
        showError(e.message);
      });
    }
  }, [ctx]);

  useEffect(() => {
    fetchClasses(sessionId).then(list => {
      setClasses(list);
      if (!list.find(c => c.id === classId) && list.length) {
        setClassId(list[0].id);
      }
    }).catch(() => setClasses([]));
  }, [sessionId]);

  const loadAssigned = useCallback(() => {
    if (classId) {
      fetchAssignedSubjectIds(classId).then(setAssigned).catch(() => {});
    }
  }, [classId]);

  useEffect(() => {
    loadAssigned();
  }, [loadAssigned]);

  const flip = async (id: string, on: boolean) => {
    const next = new Set(assigned);
    if (on) {
      next.add(id);
    } else {
      next.delete(id);
    }
    setAssigned(next);
    try {
      await toggleClassSubject(classId, id, on);
    } catch (e: any) {
      showError(e.message);
      loadAssigned();
    }
  };

  if (!subjects) {
    return (
      <Screen>
        <Skeleton height={200} radius={20} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={subjects}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.pickers}>
              <OptionField compact label="Session" value={sessionId} options={sessions.map(s => ({ value: s.id, label: s.name + (s.is_current ? ' (Current)' : '') }))} onChange={setSessionId} />
              <OptionField compact label="Class" value={classId} options={classes.map(c => ({ value: c.id, label: classLabel(c) }))} onChange={setClassId} />
            </View>
            <Text style={[text.small, styles.hint]}>Switch on the subjects this class offers.</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="book" title="No subjects yet" message="Ask your school admin to create subjects first (More admin tools, then Subjects), then come back here to assign them to this class." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]}>{item.name}</Text>
            <Switch value={assigned.has(item.id)} onValueChange={v => flip(item.id, v)} trackColor={{ false: '#D5D8DE', true: colors.primaryLight }} thumbColor={assigned.has(item.id) ? colors.primary : '#FFFFFF'} />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  pickers: { flexDirection: 'row', gap: spacing.md },
  hint: { color: colors.textMuted, marginVertical: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
});
