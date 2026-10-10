import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { EmptyState, FilterChips, Icon, Screen, Skeleton } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { useStaff } from '../lib/useStaff';
import { addDays, fetchAttendanceMode, lagosToday, longDay, Mode } from '../lib/attendance';

type ClassBlock = { id: string; name: string; students: { id: string; full_name: string }[] };

const TONE: Record<string, { fg: string; bg: string; label: string }> = {
  present: { fg: colors.success, bg: colors.successSoft, label: 'Present' },
  absent: { fg: colors.danger, bg: colors.dangerSoft, label: 'Absent' },
  none: { fg: colors.textMuted, bg: '#EEF1F4', label: 'No record' },
};

function Tag({ status, prefix }: { status?: string; prefix?: string }) {
  const t = TONE[status === 'present' || status === 'absent' ? status : 'none'];
  return <Text style={[styles.tag, { color: t.fg, backgroundColor: t.bg }]}>{(prefix ? prefix + ' ' : '') + t.label}</Text>;
}

// Staff view of the register for the classes they teach: pick a day, see who was marked present or absent.
export default function AttendanceHistoryScreen() {
  const { ctx, loading: ctxLoading } = useStaff();
  const [classes, setClasses] = useState<ClassBlock[] | null>(null);
  const [mode, setMode] = useState<Mode>('combined');
  const [day, setDay] = useState(lagosToday());
  const [filter, setFilter] = useState('all');
  const [marks, setMarks] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const today = lagosToday();

  // "My classes" are the classes where this person is the class teacher.
  const loadClasses = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      setError('');
      setMode(await fetchAttendanceMode(ctx.schoolId));
      const { data: rows } = await supabase.from('classes').select('id, name, arm').eq('school_id', ctx.schoolId).eq('class_teacher_id', ctx.userId);
      const byId: Record<string, ClassBlock> = {};
      ((rows || []) as any[]).forEach(c => (byId[c.id] = { id: c.id, name: c.arm ? c.name + ' ' + c.arm : c.name, students: [] }));
      const ids = Object.keys(byId);
      if (ids.length) {
        const { data: roster } = await supabase.from('student_class_history').select('class_id, students(id, full_name)').in('class_id', ids);
        ((roster || []) as any[]).forEach(r => {
          const list = byId[r.class_id];
          if (r.students && list && !list.students.some(s => s.id === r.students.id)) {
            list.students.push(r.students);
          }
        });
      }
      const list = Object.values(byId).sort((a, b) => a.name.localeCompare(b.name));
      list.forEach(c => c.students.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')));
      setClasses(list);
    } catch (e: any) {
      setClasses([]);
      setError(e && e.message ? e.message : 'Could not load your classes.');
    }
  }, [ctx]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const shown = classes ? (filter === 'all' ? classes : classes.filter(c => c.id === filter)) : [];
  const shownKey = shown.map(c => c.id).join(',');

  useEffect(() => {
    if (!classes || !shown.length) {
      setMarks([]);
      return;
    }
    let alive = true;
    setMarks(null);
    supabase
      .from('daily_attendance_marks')
      .select('student_id, class_id, session, status')
      .eq('mark_date', day)
      .in('class_id', shown.map(c => c.id))
      .then(({ data, error: e }: any) => {
        if (!alive) {
          return;
        }
        if (e) {
          setError('Could not load attendance for this day.');
        }
        setMarks(data || []);
      });
    return () => {
      alive = false;
    };
  }, [classes, shownKey, day]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => {
    setRefreshing(true);
    await loadClasses();
    setRefreshing(false);
  };

  if (ctxLoading || classes === null) {
    return (
      <Screen>
        <Skeleton height={120} radius={22} />
      </Screen>
    );
  }
  if (classes.length === 0) {
    return (
      <Screen>
        <EmptyState icon="clipboard" title="No classes assigned yet" message="Your school admin needs to set you as the class teacher for a class before attendance history can show here." />
      </Screen>
    );
  }

  const byClass: Record<string, Record<string, Record<string, string>>> = {};
  (marks || []).forEach(m => {
    byClass[m.class_id] = byClass[m.class_id] || {};
    byClass[m.class_id][m.student_id] = byClass[m.class_id][m.student_id] || {};
    byClass[m.class_id][m.student_id][m.session] = m.status;
  });
  const markedCount = shown.filter(c => byClass[c.id] && Object.keys(byClass[c.id]).length > 0).length;
  const allMarked = markedCount === shown.length;
  const isToday = day >= today;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View>
          <Text style={[text.h2, { color: colors.text }]}>Attendance History</Text>
          <Text style={[text.small, { color: colors.textMuted }]}>Pick a day to see whether you marked the register for your classes.</Text>
        </View>

        <View style={styles.dateRow}>
          <Pressable onPress={() => setDay(addDays(day, -1))} style={styles.step} hitSlop={8} accessibilityLabel="Previous day">
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <Icon name="chevron" size={18} color={colors.text} />
            </View>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[text.bodyStrong, { color: colors.text }]}>{longDay(day)}</Text>
            {!isToday ? (
              <Pressable onPress={() => setDay(today)}>
                <Text style={[text.small, { color: colors.primary }]}>Back to today</Text>
              </Pressable>
            ) : (
              <Text style={[text.small, { color: colors.textMuted }]}>Today</Text>
            )}
          </View>
          <Pressable onPress={() => setDay(addDays(day, 1))} style={[styles.step, isToday && { opacity: 0.35 }]} disabled={isToday} hitSlop={8} accessibilityLabel="Next day">
            <Icon name="chevron" size={18} color={colors.text} />
          </Pressable>
        </View>

        {classes.length > 1 ? <FilterChips options={[{ key: 'all', label: 'All my classes' }, ...classes.map(c => ({ key: c.id, label: c.name }))]} value={filter} onChange={setFilter} /> : null}

        {error ? <Text style={[text.small, { color: colors.danger }]}>{error}</Text> : null}

        {marks === null ? (
          <Skeleton height={160} radius={22} />
        ) : (
          <>
            <View style={styles.summary}>
              <Text style={[styles.tag, { color: allMarked ? colors.success : colors.accentDark, backgroundColor: allMarked ? colors.successSoft : colors.accentSoft }]}>
                {allMarked ? 'Marked' : markedCount + ' of ' + shown.length + ' marked'}
              </Text>
              <Text style={[text.small, { color: colors.textMuted }]}>{'for ' + longDay(day)}</Text>
            </View>

            {shown.map(c => {
              const classMarks = byClass[c.id] || {};
              const marked = Object.keys(classMarks).length > 0;
              return (
                <View key={c.id} style={styles.block}>
                  <View style={styles.blockHead}>
                    <Text style={[text.h3, { color: colors.text, flex: 1 }]} numberOfLines={2}>{c.name}</Text>
                    <Text style={[styles.tag, { color: marked ? colors.success : colors.danger, backgroundColor: marked ? colors.successSoft : colors.dangerSoft }]}>{marked ? 'Register marked' : 'Not marked'}</Text>
                  </View>
                  {c.students.length === 0 ? (
                    <Text style={[text.small, { color: colors.textMuted }]}>No students in this class yet.</Text>
                  ) : (
                    c.students.map((s, i) => {
                      const m = classMarks[s.id] || {};
                      return (
                        <View key={s.id} style={[styles.student, i > 0 && styles.divider]}>
                          <Text style={[text.body, { color: colors.text, flex: 1 }]} numberOfLines={2}>{s.full_name}</Text>
                          {mode === 'separate' ? (
                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                              <Tag status={m.morning} prefix="AM" />
                              <Tag status={m.afternoon} prefix="PM" />
                            </View>
                          ) : (
                            <Tag status={m.combined} />
                          )}
                        </View>
                      );
                    })
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  step: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  block: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  blockHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  student: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
});
