import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, StyleSheet, Text, View, Pressable } from 'react-native';
import { Badge, Button, Card, EmptyState, OptionField, PeriodControls, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { useStaff } from '../lib/useStaff';
import { showError } from '../lib/confirm';
import { toISODateLocal } from '../lib/format';
import { classLabel, fetchClasses, fetchClassRoster } from '../lib/school';
import { downloadPdf, makePdf, sharePdf, simpleTableHtml } from '../lib/pdfDoc';
import { fetchCurrentSession, fetchStudentMarks, monthRange, PeriodType, weekRange } from '../lib/admin';

const TYPES: PeriodType[] = ['day', 'week', 'month', 'term', 'session'];

const dayLabel = (d: string) => {
  const dt = new Date(d + 'T00:00:00');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()] + ', ' + dt.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getMonth()] + ' ' + dt.getFullYear();
};

export default function StudentAttendanceScreen() {
  const { ctx, loading: ctxLoading } = useStaff();
  const canView = !!ctx && (ctx.role === 'owner' || (ctx.role === 'teacher_admin' && ctx.membership.can_view_attendance_reports === true));
  const [session, setSession] = useState<any>(undefined);
  const [classes, setClasses] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [classId, setClassId] = useState('');
  const [type, setType] = useState<PeriodType>('day');
  const [date, setDate] = useState(toISODateLocal(new Date()));
  const [month, setMonth] = useState(toISODateLocal(new Date()).slice(0, 7));
  const [termId, setTermId] = useState('');
  const [roster, setRoster] = useState<any[]>([]);
  const [dayMarks, setDayMarks] = useState<Record<string, string>>({});
  const [agg, setAgg] = useState<Record<string, any[]>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!ctx || !canView) {
      setSession(canView ? undefined : null);
      return;
    }
    (async () => {
      try {
        const s = await fetchCurrentSession(ctx.schoolId);
        setSession(s || null);
        if (s) {
          const [cls, t] = await Promise.all([fetchClasses(s.id), supabase.from('terms').select('id, name, is_current').eq('session_id', s.id).order('created_at')]);
          setClasses(cls);
          setTerms(t.data || []);
          if (cls.length) {
            setClassId(cls[0].id);
          }
          const cur = (t.data || []).find((x: any) => x.is_current) || (t.data || [])[0];
          setTermId(cur ? cur.id : '');
        }
      } catch (e: any) {
        setSession(null);
        showError(e.message);
      }
    })();
  }, [ctx, canView]);

  useEffect(() => {
    if (!session || !classId) {
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const r = await fetchClassRoster(classId, session.id);
        if (!alive) {
          return;
        }
        setRoster(r);
        if (type === 'day') {
          const { data } = await supabase.from('daily_attendance_marks').select('student_id, status').eq('class_id', classId).eq('mark_date', date);
          const map: Record<string, string> = {};
          (data || []).forEach((m: any) => {
            map[m.student_id] = m.status;
          });
          if (alive) {
            setDayMarks(map);
          }
        } else {
          const range = type === 'week' ? weekRange(date) : type === 'month' ? monthRange(month) : type === 'term' ? { termIds: termId ? [termId] : [] } : { termIds: terms.map(t => t.id) };
          const marks = await fetchStudentMarks(classId, range as any);
          if (alive) {
            setAgg(marks);
          }
        }
      } catch (e: any) {
        showError(e.message);
      }
      if (alive) {
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [session, classId, type, date, month, termId, terms]);

  const className = useMemo(() => {
    const c = classes.find(x => x.id === classId);
    return c ? classLabel(c) : '';
  }, [classes, classId]);

  const periodLabel = type === 'day' ? 'Day' : type === 'week' ? 'Week' : type === 'month' ? 'Month' : type === 'term' ? 'Term' : 'Session';

  const exportStudent = async (s: any, mode: 'share' | 'download') => {
    const list = agg[s.id] || [];
    const html = simpleTableHtml(s.full_name + ' Attendance', className + '. ' + periodLabel + ' view.', ['Date', 'Status'], list.map((r: any) => [dayLabel(r.mark_date), r.status === 'present' ? 'Present' : 'Absent']));
    setBusy(s.id + mode);
    try {
      const pdf = await makePdf(html, 'Attendance ' + s.full_name);
      if (mode === 'share') {
        await sharePdf(pdf.path, 'Attendance Report');
      } else {
        const where = await downloadPdf(pdf.path, pdf.fileName);
        Alert.alert('Saved', 'The report was saved to ' + where + ' as ' + pdf.fileName);
      }
    } catch (e: any) {
      showError('Could not generate PDF: ' + (e.message || 'Unknown error'));
    }
    setBusy('');
  };

  if (ctxLoading || session === undefined) {
    return (
      <Screen>
        <Skeleton height={200} radius={24} />
      </Screen>
    );
  }

  if (!canView) {
    return (
      <Screen>
        <EmptyState icon="shield" title="No permission" message="You do not have permission to view student attendance. Ask the school owner to turn it on for you in Teachers and Roles." />
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

  return (
    <Screen padded={false}>
      <FlatList
        data={loading ? [] : roster}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          <View>
            <OptionField label="Class" value={classId} options={classes.map(c => ({ value: c.id, label: classLabel(c) }))} onChange={setClassId} placeholder="No classes yet" />
            <PeriodControls types={TYPES} type={type} onType={setType} date={date} onDate={setDate} month={month} onMonth={setMonth} termId={termId} onTerm={setTermId} terms={terms} />
            {loading ? <Text style={[text.small, { color: colors.textMuted }]}>Loading</Text> : null}
          </View>
        }
        ListEmptyComponent={loading ? null : <EmptyState icon="users" title={classes.length ? 'No students in this class' : 'No classes yet'} />}
        renderItem={({ item }) => {
          if (type === 'day') {
            const st = dayMarks[item.id];
            return (
              <Card style={{ padding: spacing.md }}>
                <View style={styles.row}>
                  <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={1}>{item.full_name}</Text>
                  <Badge label={st === 'present' ? 'Present' : st === 'absent' ? 'Absent' : 'No record'} tone={st === 'present' ? 'green' : st === 'absent' ? 'orange' : 'purple'} />
                </View>
              </Card>
            );
          }
          const list = agg[item.id] || [];
          const p = list.filter((r: any) => r.status === 'present').length;
          const a = list.filter((r: any) => r.status === 'absent').length;
          const expanded = !!open[item.id];
          return (
            <Card style={{ padding: spacing.md }}>
              <Pressable onPress={() => setOpen(o => ({ ...o, [item.id]: !o[item.id] }))} style={styles.row}>
                <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={1}>{item.full_name}</Text>
                <Text style={[text.caption, { color: colors.success }]}>{p + ' present'}</Text>
                <Text style={[text.caption, { color: colors.danger, marginLeft: 10 }]}>{a + ' absent'}</Text>
              </Pressable>
              {expanded ? (
                <View style={{ marginTop: spacing.md }}>
                  {list.length === 0 ? <Text style={[text.small, { color: colors.textMuted }]}>No attendance recorded for this period.</Text> : null}
                  {list.map((r: any) => (
                    <View key={r.mark_date} style={styles.dateRow}>
                      <Text style={[text.small, { color: colors.text }]}>{dayLabel(r.mark_date)}</Text>
                      <Badge label={r.status === 'present' ? 'Present' : 'Absent'} tone={r.status === 'present' ? 'green' : 'orange'} />
                    </View>
                  ))}
                  {list.length > 0 ? (
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                      <Button title="Share PDF" icon="send" variant="outline" loading={busy === item.id + 'share'} onPress={() => exportStudent(item, 'share')} style={{ flex: 1, height: 44 }} />
                      <Button title="Download PDF" icon="down" loading={busy === item.id + 'download'} onPress={() => exportStudent(item, 'download')} style={{ flex: 1, height: 44 }} />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
