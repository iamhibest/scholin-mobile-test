import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FilterChips, Icon, Notice, Screen, SearchBar, Skeleton } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { fetchStaffAttendance } from '../lib/superAdmin';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'present', label: 'Present' },
  { key: 'late', label: 'Late' },
  { key: 'absent', label: 'Absent' },
  { key: 'not_clocked_out', label: 'Not clocked out' },
];
const STATUS_COLOR: Record<string, string> = { present: colors.success, late: colors.accentDark, absent: colors.danger };

function ymd(d: Date) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function time(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function SuperAdminAttendanceScreen() {
  const [day, setDay] = useState(new Date());
  const [data, setData] = useState<{ staff: any[]; records: any[] } | null>(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const date = ymd(day);

  const load = useCallback(async () => {
    try {
      setError('');
      setData(await fetchStaffAttendance(date));
    } catch (e: any) {
      setData(prev => prev || { staff: [], records: [] });
      setError(e.message);
    }
  }, [date]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const shift = (n: number) => {
    const d = new Date(day);
    d.setDate(d.getDate() + n);
    setDay(d);
  };

  const rows = (data ? data.staff : [])
    .map(m => {
      const record = data!.records.find(r => r.user_id === m.profile_id && r.school_id === m.school_id);
      const status = record && record.clock_in_time ? record.clock_in_status : 'absent';
      return { key: m.profile_id + m.school_id, staff: m.profiles, school: m.schools, record, status, notOut: !!(record && record.clock_in_time && !record.clock_out_time) };
    })
    .filter(r => {
      const q = query.trim().toLowerCase();
      if (q && !(r.staff.full_name || '').toLowerCase().includes(q) && !(r.school.name || '').toLowerCase().includes(q)) {
        return false;
      }
      if (filter === 'not_clocked_out') {
        return r.notOut;
      }
      return filter === 'all' || r.status === filter;
    })
    .sort((a, b) => (a.staff.full_name || '').localeCompare(b.staff.full_name || ''));

  const present = data ? data.records.filter(r => r.clock_in_status === 'present').length : 0;
  const late = data ? data.records.filter(r => r.clock_in_status === 'late').length : 0;
  const isToday = date === ymd(new Date());

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <View style={styles.dateRow}>
          <Pressable onPress={() => shift(-1)} style={styles.step} hitSlop={8}>
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <Icon name="chevron" size={18} color={colors.text} />
            </View>
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={[text.bodyStrong, { color: colors.text }]}>{day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
            {!isToday ? (
              <Pressable onPress={() => setDay(new Date())}>
                <Text style={[text.small, { color: colors.primary }]}>Back to today</Text>
              </Pressable>
            ) : (
              <Text style={[text.small, { color: colors.textMuted }]}>Today</Text>
            )}
          </View>
          <Pressable onPress={() => shift(1)} style={[styles.step, isToday && { opacity: 0.35 }]} disabled={isToday} hitSlop={8}>
            <Icon name="chevron" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.stats}>
          {[['Expected', data ? data.staff.length : 0, colors.text], ['Present', present, colors.success], ['Late', late, colors.accentDark]].map(([label, value, color]) => (
            <View key={label as string} style={styles.stat}>
              <Text style={[text.h3, { color: color as string }]}>{String(value)}</Text>
              <Text style={[text.caption, { color: colors.textMuted }]}>{label as string}</Text>
            </View>
          ))}
        </View>

        <SearchBar value={query} onChange={setQuery} placeholder="Search staff or school" />
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
        <Notice message={error} tone="error" />

        {data === null ? (
          <Skeleton height={160} radius={20} />
        ) : rows.length === 0 ? (
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl }]}>No matching records.</Text>
        ) : (
          rows.map(r => (
            <View key={r.key} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{r.staff.full_name}</Text>
                <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>{r.school.name}</Text>
                <Text style={[text.caption, { color: colors.textMuted, marginTop: 2 }]}>
                  {'In: ' + (r.record && r.record.clock_in_time ? time(r.record.clock_in_time) : 'None') + '    Out: ' + (r.record && r.record.clock_out_time ? time(r.record.clock_out_time) : 'None')}
                </Text>
              </View>
              <Text style={[styles.tag, { color: STATUS_COLOR[r.status] || colors.textMuted, borderColor: STATUS_COLOR[r.status] || colors.border }]}>{String(r.status).replace('_', ' ')}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  step: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 18, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  tag: { fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden', textTransform: 'capitalize' },
});
