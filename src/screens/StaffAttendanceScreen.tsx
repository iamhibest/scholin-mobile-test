import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Badge, Button, Card, DateField, EmptyState, OptionField, PeriodControls, Screen, SearchBar, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { useStaff } from '../lib/useStaff';
import { showError } from '../lib/confirm';
import { toISODateLocal } from '../lib/format';
import { timeLabel } from '../lib/attendance';
import { downloadPdf, makePdf, sharePdf, simpleTableHtml } from '../lib/pdfDoc';
import { fetchStaffDay, fetchStaffMembers, fetchStaffRange, monthRange, PeriodType, staffSessionRange, staffTermRange, weekRange } from '../lib/admin';
import { fetchCurrentSession } from '../lib/admin';

const TYPES: PeriodType[] = ['week', 'month', 'term', 'session'];

const dayLabel = (d: string) => {
  const dt = new Date(d + 'T00:00:00');
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()] + ', ' + dt.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][dt.getMonth()] + ' ' + dt.getFullYear();
};

export default function StaffAttendanceScreen({ navigation }: any) {
  const { ctx, loading: ctxLoading } = useStaff();
  const [tab, setTab] = useState<'daily' | 'reports'>('daily');
  const [staff, setStaff] = useState<{ id: string; full_name: string }[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [ready, setReady] = useState(false);
  const canView = !!ctx && (ctx.role === 'owner' || (ctx.role === 'teacher_admin' && ctx.membership.can_view_attendance_reports === true));

  const [date, setDate] = useState(toISODateLocal(new Date()));
  const [records, setRecords] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [dayLoading, setDayLoading] = useState(false);

  const [type, setType] = useState<PeriodType>('week');
  const [rdate, setRdate] = useState(toISODateLocal(new Date()));
  const [month, setMonth] = useState(toISODateLocal(new Date()).slice(0, 7));
  const [termId, setTermId] = useState('');
  const [byStaff, setByStaff] = useState<Record<string, any[]>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [repLoading, setRepLoading] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!ctx || !canView) {
      setReady(true);
      return;
    }
    (async () => {
      try {
        const [members, session] = await Promise.all([fetchStaffMembers(ctx.schoolId), fetchCurrentSession(ctx.schoolId)]);
        setStaff(members);
        if (session) {
          const { data } = await supabase.from('terms').select('id, name, is_current, created_at, term_end_date').eq('session_id', session.id).order('created_at');
          const list = data || [];
          setTerms(list);
          const current = list.find((t: any) => t.is_current) || list[list.length - 1];
          setTermId(current ? current.id : '');
        }
      } catch (e: any) {
        showError(e.message);
      }
      setReady(true);
    })();
  }, [ctx, canView]);

  const loadDay = useCallback(async () => {
    if (!ctx || !canView) {
      return;
    }
    setDayLoading(true);
    try {
      setRecords(await fetchStaffDay(ctx.schoolId, date));
    } catch (e: any) {
      showError(e.message);
    }
    setDayLoading(false);
  }, [ctx, canView, date]);

  useFocusEffect(
    useCallback(() => {
      loadDay();
    }, [loadDay]),
  );

  const range = useMemo(() => {
    if (type === 'week') {
      return weekRange(rdate);
    }
    if (type === 'month') {
      return monthRange(month);
    }
    if (type === 'term') {
      return staffTermRange(terms, termId);
    }
    return staffSessionRange(terms);
  }, [type, rdate, month, termId, terms]);

  useEffect(() => {
    if (tab !== 'reports' || !ctx || !canView) {
      return;
    }
    if (!range) {
      setByStaff({});
      return;
    }
    setRepLoading(true);
    fetchStaffRange(ctx.schoolId, range.start, range.end)
      .then(setByStaff)
      .catch(e => showError(e.message))
      .finally(() => setRepLoading(false));
  }, [tab, ctx, canView, range]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff
      .map(s => {
        const record = records.find(r => r.user_id === s.id);
        let st = 'absent';
        if (record && record.clock_in_time) {
          st = record.clock_in_status;
        }
        const notOut = !!(record && record.clock_in_time && !record.clock_out_time);
        return { s, record, st, notOut };
      })
      .filter(r => {
        if (q && !r.s.full_name.toLowerCase().includes(q)) {
          return false;
        }
        if (status === 'not_clocked_out' && !r.notOut) {
          return false;
        }
        if (status && status !== 'not_clocked_out' && r.st !== status) {
          return false;
        }
        return true;
      });
  }, [staff, records, query, status]);

  const expected = staff.length;
  const present = records.filter(r => r.clock_in_status === 'present').length;
  const late = records.filter(r => r.clock_in_status === 'late').length;
  const absent = Math.max(0, expected - records.filter(r => r.clock_in_time).length);

  const periodLabel = type === 'week' ? 'Week' : type === 'month' ? 'Month' : type === 'term' ? 'Term' : 'Session';

  const exportStaff = async (s: { id: string; full_name: string }, mode: 'share' | 'download') => {
    const list = byStaff[s.id] || [];
    const html = simpleTableHtml(
      s.full_name + ' Attendance',
      periodLabel + ' view.',
      ['Date', 'Status', 'Clock in', 'Clock out'],
      list.map((r: any) => [dayLabel(r.date), r.clock_in_time ? (r.clock_in_status === 'late' ? 'Late' : 'Present') : 'Absent', r.clock_in_time ? timeLabel(r.clock_in_time) : '-', r.clock_out_time ? timeLabel(r.clock_out_time) : '-']),
    );
    setBusy(s.id + mode);
    try {
      const pdf = await makePdf(html, 'Attendance ' + s.full_name);
      if (mode === 'share') {
        await sharePdf(pdf.path, 'Staff Attendance Report');
      } else {
        const where = await downloadPdf(pdf.path, pdf.fileName);
        Alert.alert('Saved', 'The report was saved to ' + where + ' as ' + pdf.fileName);
      }
    } catch (e: any) {
      showError('Could not generate PDF: ' + (e.message || 'Unknown error'));
    }
    setBusy('');
  };

  if (ctxLoading || !ready) {
    return (
      <Screen>
        <Skeleton height={200} radius={24} />
      </Screen>
    );
  }

  if (!canView) {
    return (
      <Screen>
        <EmptyState icon="shield" title="No permission" message="You do not have permission to view staff attendance. Ask the school owner to turn it on for you in Teachers and Roles." />
      </Screen>
    );
  }

  const stat = (label: string, value: number, color: string) => (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[text.caption, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={tab === 'daily' ? rows : staff}
        keyExtractor={(i: any) => (tab === 'daily' ? i.s.id : i.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          <View>
            <View style={styles.tabs}>
              {(['daily', 'reports'] as const).map(t => (
                <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}>
                  <Text style={[text.bodyStrong, { color: tab === t ? colors.primary : colors.textMuted }]}>{t === 'daily' ? 'Daily' : 'Reports'}</Text>
                </Pressable>
              ))}
            </View>

            {tab === 'daily' ? (
              <View>
                <DateField label="Date" value={date} onChange={setDate} clearable={false} />
                <View style={styles.stats}>
                  {stat('Expected', expected, colors.text)}
                  {stat('Present', present, colors.success)}
                  {stat('Late', late, colors.accentDark)}
                  {stat('Absent', absent, colors.danger)}
                </View>
                <SearchBar value={query} onChange={setQuery} placeholder="Search staff" />
                <View style={{ height: spacing.md }} />
                <OptionField
                  label="Status"
                  value={status}
                  options={[
                    { value: '', label: 'All statuses' },
                    { value: 'present', label: 'Present' },
                    { value: 'late', label: 'Late' },
                    { value: 'absent', label: 'Absent' },
                    { value: 'not_clocked_out', label: 'Not clocked out' },
                  ]}
                  onChange={setStatus}
                />
              </View>
            ) : (
              <View>
                <PeriodControls types={TYPES} type={type} onType={setType} date={rdate} onDate={setRdate} month={month} onMonth={setMonth} termId={termId} onTerm={setTermId} terms={terms} />
                {!range ? <Text style={[text.small, { color: colors.danger }]}>Could not work out that period.</Text> : repLoading ? <Text style={[text.small, { color: colors.textMuted }]}>Loading</Text> : null}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={dayLoading ? null : <EmptyState icon="users" title="No matching staff" />}
        renderItem={({ item }: any) => {
          if (tab === 'daily') {
            const { s, record, st } = item;
            const proxy: string[] = [];
            if (record && record.clock_in_proxy && record.clock_in_proxy.full_name) {
              proxy.push('Clocked in by ' + record.clock_in_proxy.full_name);
            }
            if (record && record.clock_out_proxy && record.clock_out_proxy.full_name) {
              proxy.push('Clocked out by ' + record.clock_out_proxy.full_name);
            }
            return (
              <Card onPress={record ? () => navigation.navigate('StaffAttendanceDetail', { recordId: record.id }) : undefined} style={{ padding: spacing.md }}>
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{s.full_name}</Text>
                    <Text style={[text.small, { color: colors.textMuted }]}>{'In: ' + (record && record.clock_in_time ? timeLabel(record.clock_in_time) : '-') + '   Out: ' + (record && record.clock_out_time ? timeLabel(record.clock_out_time) : '-')}</Text>
                    {proxy.length ? <Text style={[text.caption, { color: colors.primary, marginTop: 2 }]}>{proxy.join('   ')}</Text> : null}
                  </View>
                  <Badge label={st === 'present' ? 'Present' : st === 'late' ? 'Late' : 'Absent'} tone={st === 'present' ? 'green' : st === 'late' ? 'orange' : 'purple'} />
                </View>
              </Card>
            );
          }
          const list = byStaff[item.id] || [];
          const lates = list.filter((r: any) => r.clock_in_status === 'late').length;
          const absents = list.filter((r: any) => !r.clock_in_time).length;
          const expanded = !!open[item.id];
          return (
            <Card style={{ padding: spacing.md }}>
              <Pressable onPress={() => setOpen(o => ({ ...o, [item.id]: !o[item.id] }))} style={styles.row}>
                <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={1}>{item.full_name}</Text>
                <Text style={[text.caption, { color: colors.accentDark }]}>{lates + ' late'}</Text>
                <Text style={[text.caption, { color: colors.danger, marginLeft: 10 }]}>{absents + ' absent'}</Text>
              </Pressable>
              {expanded ? (
                <View style={{ marginTop: spacing.md }}>
                  {list.length === 0 ? <Text style={[text.small, { color: colors.textMuted }]}>No attendance recorded for this period.</Text> : null}
                  {list.map((r: any) => (
                    <View key={r.date} style={styles.dateRow}>
                      <Text style={[text.small, { color: colors.text }]}>{dayLabel(r.date)}</Text>
                      <Badge label={r.clock_in_time ? (r.clock_in_status === 'late' ? 'Late' : 'Present') : 'Absent'} tone={r.clock_in_time ? (r.clock_in_status === 'late' ? 'orange' : 'green') : 'purple'} />
                    </View>
                  ))}
                  {list.length > 0 ? (
                    <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                      <Button title="Share PDF" icon="send" variant="outline" loading={busy === item.id + 'share'} onPress={() => exportStaff(item, 'share')} style={{ flex: 1, height: 44 }} />
                      <Button title="Download PDF" icon="down" loading={busy === item.id + 'download'} onPress={() => exportStaff(item, 'download')} style={{ flex: 1, height: 44 }} />
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
  tabs: { flexDirection: 'row', backgroundColor: '#EDEEF0', borderRadius: radius.pill, padding: 4, marginBottom: spacing.lg },
  tab: { flex: 1, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.surface },
  stats: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
