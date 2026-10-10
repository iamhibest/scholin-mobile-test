import React, { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar, EmptyState, FilterChips, Screen, Skeleton } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { Birthday, BirthdaySummary, fetchBirthdayRows, summarizeBirthdays } from '../lib/birthdays';
import { lagosToday } from '../lib/attendance';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function Row({ b, tag, tagColor }: { b: Birthday; tag?: string; tagColor?: string }) {
  return (
    <View style={styles.row}>
      <Avatar name={b.name} uri={b.photo || undefined} size={42} />
      <View style={{ flex: 1 }}>
        <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={2}>{b.name}</Text>
        <Text style={[text.small, { color: colors.textMuted }]}>{b.dateLabel + ', turning ' + b.turning}</Text>
      </View>
      {tag ? <Text style={[styles.tag, { color: tagColor || colors.primary, backgroundColor: (tagColor || colors.primary) + '1F' }]}>{tag}</Text> : null}
    </View>
  );
}

export default function BirthdaysScreen() {
  const { ctx, loading } = useStaff();
  const [sum, setSum] = useState<BirthdaySummary | null>(null);
  const [view, setView] = useState('upcoming');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const todayStr = lagosToday();
  const monthName = MONTH_NAMES[Number(todayStr.slice(5, 7)) - 1];
  const nextName = MONTH_NAMES[Number(todayStr.slice(5, 7)) % 12];

  const load = useCallback(
    async (force = false) => {
      if (!ctx) {
        return;
      }
      try {
        setError('');
        setSum(summarizeBirthdays(await fetchBirthdayRows(ctx.schoolId, force)));
      } catch (e: any) {
        setSum(prev => prev || summarizeBirthdays([]));
        setError(e && e.message ? e.message : 'Could not load birthdays.');
      }
    },
    [ctx],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading || !sum) {
    return (
      <Screen>
        <Skeleton height={140} radius={22} />
      </Screen>
    );
  }

  const upcomingAll = [...sum.today, ...sum.tomorrow.filter(t => !sum.today.some(x => x.id === t.id)), ...sum.upcoming.filter(u => !sum.tomorrow.some(x => x.id === u.id))];
  const list = view === 'earlier' ? sum.earlier : view === 'next' ? sum.nextMonth : upcomingAll;
  const tagFor = (b: Birthday) => (sum.today.some(x => x.id === b.id) ? 'Today' : sum.tomorrow.some(x => x.id === b.id) ? 'Tomorrow' : undefined);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(true); setRefreshing(false); }} />}>
        <View>
          <Text style={[text.h2, { color: colors.text }]}>Birthdays</Text>
          <Text style={[text.small, { color: colors.textMuted }]}>{'Student birthdays in ' + monthName + ' and ' + nextName}</Text>
        </View>
        <FilterChips
          options={[
            { key: 'upcoming', label: 'Upcoming (' + upcomingAll.length + ')' },
            { key: 'earlier', label: 'Earlier (' + sum.earlier.length + ')' },
            { key: 'next', label: nextName + ' (' + sum.nextMonth.length + ')' },
          ]}
          value={view}
          onChange={setView}
        />
        {error ? <Text style={[text.small, { color: colors.danger }]}>{error}</Text> : null}
        {list.length === 0 ? (
          <EmptyState
            icon="gift"
            title="No birthdays here"
            message={view === 'earlier' ? 'No birthdays have passed yet this month.' : view === 'next' ? 'No student birthdays next month.' : (sum.total === 0 ? 'No student has a date of birth saved yet. Open a student, tap edit, and fill in Date of birth.' : 'No more birthdays this month.')}
          />
        ) : (
          <View style={styles.card}>
            {list.map((b, i) => (
              <View key={b.id} style={i > 0 ? styles.divider : undefined}>
                <Row b={b} tag={view === 'upcoming' ? tagFor(b) : undefined} tagColor={tagFor(b) === 'Today' ? '#B26A00' : colors.danger} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
});
