import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, EmptyState, Notice, OptionField, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { fetchClasses, classLabel } from '../lib/school';
import { fetchCurrentSession, fetchUnassigned, placeStudent, runAutoPromotion } from '../lib/admin';

export default function PromotionScreen() {
  const { ctx, loading: ctxLoading } = useStaff();
  const [session, setSession] = useState<any>(undefined);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[] | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      const s = await fetchCurrentSession(ctx.schoolId);
      setSession(s || null);
      if (s) {
        setClasses(await fetchClasses(s.id));
        setStudents(await fetchUnassigned(ctx.schoolId, s.id));
      }
    } catch (e: any) {
      setSession(null);
      setNotice({ message: e.message, tone: 'error' });
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const rerun = async () => {
    if (!ctx || !session) {
      return;
    }
    setRunning(true);
    try {
      const r = await runAutoPromotion(ctx.schoolId, session.id);
      setNotice({
        message: r.promoted + ' student(s) promoted automatically.' + (r.skipped > 0 ? ' ' + r.skipped + ' still need manual assignment below.' : ' Everyone is assigned.'),
        tone: 'success',
      });
      await load();
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setRunning(false);
  };

  const assign = async (studentId: string, classId: string) => {
    if (!classId || !session) {
      return;
    }
    try {
      await placeStudent(studentId, classId, session.id);
      await load();
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
  };

  if (ctxLoading || session === undefined) {
    return (
      <Screen>
        <Skeleton height={160} radius={20} />
      </Screen>
    );
  }

  if (ctx && !ctx.isAdmin) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Admins only" message="Only the school owner and teacher admins can promote students." />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <EmptyState icon="calendar" title="No current session set" message="Set a current session in Sessions and Terms first." />
      </Screen>
    );
  }

  const options = classes.map(c => ({ value: c.id, label: classLabel(c) }));

  return (
    <Screen padded={false}>
      <FlatList
        data={students || []}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={
          <View>
            <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>{'Current session: ' + session.name + '. Students from the last session who have no class here yet are listed below.'}</Text>
            <Button title="Run auto promotion again" icon="trend" variant="soft" loading={running} onPress={rerun} style={{ marginBottom: spacing.lg }} />
            <Notice message={notice.message} tone={notice.tone} />
          </View>
        }
        ListEmptyComponent={students ? <EmptyState icon="check" title="Everyone is assigned" message="Every student from the last session has a class in this one." /> : null}
        renderItem={({ item }) => (
          <Card>
            <Text style={[text.bodyStrong, { color: colors.text }]}>{item.full_name}</Text>
            <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>{item.admission_no || 'No admission number'}</Text>
            <OptionField label="Assign to class" value="" options={options} placeholder="Not assigned" onChange={v => assign(item.id, v)} />
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
});
