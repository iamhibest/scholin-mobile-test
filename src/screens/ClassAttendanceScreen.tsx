import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Button, Card, EmptyState, Icon, Notice, Screen, Skeleton } from '../components';
import { colors, fonts, radius, shadow, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { showError } from '../lib/confirm';
import { fetchClassRoster } from '../lib/school';
import { addDays, buildRows, dayParts, fetchAttendanceMode, fetchDayMarks, fetchDaysOpen, longDay, Marks, Mode, saveDaysOpen, weekStartOf } from '../lib/attendance';
import { flushQueue, queueCount, saveRegister } from '../lib/offlineQueue';
import { toISODateLocal } from '../lib/format';

export default function ClassAttendanceScreen({ navigation, route }: any) {
  const { classId, sessionId, termId, className } = route.params;
  const params = route.params;
  const { ctx } = useStaff();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('combined');
  const [roster, setRoster] = useState<any[]>([]);
  const [weekStart, setWeekStart] = useState(weekStartOf());
  const [date, setDate] = useState(toISODateLocal(new Date()));
  const [marks, setMarks] = useState<Marks>({});
  const [daysOpen, setDaysOpen] = useState('5');
  const [ready, setReady] = useState(false);
  const [dayLoading, setDayLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });
  const [pending, setPending] = useState(0);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Attendance' });
  }, [navigation]);

  useEffect(() => {
    if (!ctx) {
      return;
    }
    Promise.all([fetchAttendanceMode(ctx.schoolId), fetchClassRoster(classId, sessionId)])
      .then(([m, r]) => {
        setMode(m);
        setRoster(r);
        setReady(true);
      })
      .catch(e => {
        showError(e.message);
        setReady(true);
      });
    flushQueue().then(() => queueCount().then(setPending));
  }, [ctx, classId, sessionId]);

  useEffect(() => {
    fetchDaysOpen(classId, termId, weekStart).then(n => setDaysOpen(String(n)));
  }, [classId, termId, weekStart]);

  const loadDay = useCallback(async () => {
    setDayLoading(true);
    setNotice({ message: '', tone: 'success' });
    try {
      setMarks(await fetchDayMarks(classId, date));
      setDirty(false);
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setDayLoading(false);
  }, [classId, date]);

  useEffect(() => {
    if (ready) {
      loadDay();
    }
  }, [ready, loadDay]);

  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const sessions = mode === 'separate' ? ['morning', 'afternoon'] : ['combined'];

  const setMark = (studentId: string, session: string, status: string) => {
    setMarks(m => ({ ...m, [studentId]: { ...(m[studentId] || {}), [session]: status } }));
    setDirty(true);
    setNotice({ message: '', tone: 'success' });
  };

  const markAllPresent = () => {
    const next: Marks = { ...marks };
    roster.forEach(s => {
      next[s.id] = { ...(next[s.id] || {}) };
      sessions.forEach(x => {
        next[s.id][x] = 'present';
      });
    });
    setMarks(next);
    setDirty(true);
  };

  const copyMorning = () => {
    const next: Marks = { ...marks };
    roster.forEach(s => {
      const m = next[s.id];
      if (m && m.morning) {
        next[s.id] = { ...m, afternoon: m.morning };
      }
    });
    setMarks(next);
    setDirty(true);
  };

  const shiftWeek = (n: number) => {
    const next = addDays(weekStart, n * 7);
    setWeekStart(next);
    setDate(next);
  };

  const saveWeek = async () => {
    const n = parseInt(daysOpen, 10);
    if (!n || n < 1 || n > 7) {
      setNotice({ message: 'Enter a number between 1 and 7.', tone: 'error' });
      return;
    }
    try {
      if (ctx) {
        await saveDaysOpen(classId, termId, weekStart, n, ctx.userId);
      }
      setNotice({ message: 'Week setup saved.', tone: 'success' });
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
  };

  const save = async () => {
    if (!ctx) {
      return;
    }
    const rows = buildRows(roster, marks, mode, classId, termId, date, ctx.userId);
    if (rows.length === 0) {
      setNotice({ message: 'Mark at least one student before saving.', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      const result = await saveRegister(rows, className + ' ' + date);
      setDirty(false);
      setPending(await queueCount());
      setNotice({
        message: result === 'saved' ? 'Register saved for ' + longDay(date) + '.' : 'No connection. Saved on this phone and will upload automatically when you are back online.',
        tone: 'success',
      });
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setSaving(false);
  };

  if (!ready) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={60} radius={20} />
          <Skeleton height={80} radius={20} />
          <Skeleton height={80} radius={20} />
        </View>
      </Screen>
    );
  }

  const presentCount = roster.filter(s => sessions.every(x => (marks[s.id] || {})[x] === 'present')).length;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[text.h2, { color: colors.primary }]}>{className}</Text>
        <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>
          {mode === 'separate' ? 'Morning and afternoon are marked separately.' : 'One combined register per day.'}
        </Text>

        <Button title="Weekly summary" icon="trend" variant="outline" onPress={() => navigation.navigate('AttendanceSummary', params)} style={{ marginTop: spacing.md, height: 46 }} />

        {pending > 0 ? (
          <View style={styles.pending}>
            <Icon name="info" size={18} color={colors.accentDark} />
            <Text style={[text.small, { color: colors.accentDark, flex: 1 }]}>{pending + (pending === 1 ? ' register is' : ' registers are') + ' waiting to upload. They send automatically when you are online.'}</Text>
          </View>
        ) : null}

        <Card style={styles.weekCard}>
          <View style={styles.weekRow}>
            <Pressable onPress={() => shiftWeek(-1)} style={styles.arrow} hitSlop={8}>
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <Icon name="chevron" size={20} color={colors.primary} />
              </View>
            </Pressable>
            <Text style={[text.bodyStrong, { color: colors.text, flex: 1, textAlign: 'center' }]}>{'Week of ' + dayParts(weekStart).day + ' ' + dayParts(weekStart).month}</Text>
            <Pressable onPress={() => shiftWeek(1)} style={styles.arrow} hitSlop={8}>
              <Icon name="chevron" size={20} color={colors.primary} />
            </Pressable>
          </View>
          <View style={styles.setup}>
            <Text style={[text.small, { color: colors.textMuted, flex: 1 }]}>Days school is open this week</Text>
            <TextInput value={daysOpen} onChangeText={setDaysOpen} keyboardType="number-pad" maxLength={1} style={styles.daysInput} />
            <Button title="Save" variant="soft" onPress={saveWeek} style={styles.saveWeek} />
          </View>
        </Card>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
          {week.map(d => {
            const p = dayParts(d);
            const on = d === date;
            return (
              <Pressable key={d} onPress={() => setDate(d)} style={[styles.day, on && styles.dayOn]}>
                <Text style={[text.caption, { color: on ? '#FFFFFF' : colors.textMuted }]}>{p.weekday}</Text>
                <Text style={[styles.dayNum, { color: on ? '#FFFFFF' : colors.text }]}>{p.day}</Text>
                <Text style={[text.caption, { color: on ? '#FFFFFF' : colors.textMuted }]}>{p.month}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.quick}>
          <Button title="Mark all present" icon="check" variant="soft" onPress={markAllPresent} style={{ flex: 1, height: 46 }} />
          {mode === 'separate' ? <Button title="Copy morning" variant="outline" onPress={copyMorning} style={{ flex: 1, height: 46 }} /> : null}
        </View>

        <Notice message={notice.message} tone={notice.tone} />

        {dayLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : roster.length === 0 ? (
          <EmptyState icon="users" title="No students in this class yet" message="Assign students to this class first." />
        ) : (
          roster.map(s => {
            const m = marks[s.id] || {};
            return (
              <Card key={s.id} style={styles.student}>
                <View style={styles.studentTop}>
                  <Avatar name={s.full_name} uri={s.photo_url || undefined} size={40} />
                  <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={1}>{s.full_name}</Text>
                </View>
                {sessions.map(x => (
                  <View key={x} style={styles.markRow}>
                    {mode === 'separate' ? <Text style={[text.caption, styles.sessionLabel]}>{x === 'morning' ? 'AM' : 'PM'}</Text> : null}
                    <Pressable onPress={() => setMark(s.id, x, 'present')} style={[styles.mark, m[x] === 'present' && styles.markPresent]}>
                      <Text style={[text.bodyStrong, { color: m[x] === 'present' ? '#FFFFFF' : colors.success }]}>Present</Text>
                    </Pressable>
                    <Pressable onPress={() => setMark(s.id, x, 'absent')} style={[styles.mark, styles.markAbsentBase, m[x] === 'absent' && styles.markAbsent]}>
                      <Text style={[text.bodyStrong, { color: m[x] === 'absent' ? '#FFFFFF' : colors.danger }]}>Absent</Text>
                    </Pressable>
                  </View>
                ))}
              </Card>
            );
          })
        )}
      </ScrollView>

      {roster.length > 0 ? (
        <View style={[styles.bar, shadow.raised, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[text.bodyStrong, { color: colors.text }]}>{longDay(date)}</Text>
            <Text style={[text.small, { color: colors.textMuted }]}>{presentCount + ' of ' + roster.length + ' present'}{dirty ? '  |  Unsaved' : ''}</Text>
          </View>
          <Button title="Save register" loading={saving} onPress={save} style={{ paddingHorizontal: 22 }} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  pending: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md },
  weekCard: { marginTop: spacing.lg },
  weekRow: { flexDirection: 'row', alignItems: 'center' },
  arrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  setup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  daysInput: { width: 46, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 16, color: colors.text, paddingVertical: 0 },
  saveWeek: { height: 40, paddingHorizontal: 16 },
  days: { gap: spacing.sm, paddingVertical: spacing.lg },
  day: { width: 60, paddingVertical: 10, borderRadius: radius.lg, backgroundColor: colors.surface, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  dayOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayNum: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  quick: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  student: { marginBottom: spacing.md, padding: spacing.md },
  studentTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  sessionLabel: { width: 26, color: colors.textMuted },
  mark: { flex: 1, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successSoft },
  markAbsentBase: { backgroundColor: colors.dangerSoft },
  markPresent: { backgroundColor: colors.success },
  markAbsent: { backgroundColor: colors.danger },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, paddingHorizontal: spacing.xl, paddingTop: spacing.md, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
});
