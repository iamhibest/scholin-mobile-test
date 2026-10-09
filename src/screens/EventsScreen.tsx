import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Badge, Button, Card, EmptyState, Fab, Icon, Notice, Screen, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { getSchoolAccessStatus } from '../lib/dashboard';
import { naira } from '../lib/format';
import { fetchEventsWithStats, typeLabel } from '../lib/events';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const statusTone: Record<string, any> = { active: 'green', upcoming: 'blue', completed: 'purple', archived: 'orange' };

export function canManageFees(ctx: any) {
  if (!ctx || !ctx.isAdmin) {
    return false;
  }
  return !(ctx.role === 'teacher_admin' && ctx.membership && ctx.membership.can_manage_events_fees === false);
}

export default function EventsScreen({ navigation }: any) {
  const { ctx, loading: ctxLoading } = useStaff();
  const [events, setEvents] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      setError('');
      setEvents(await fetchEventsWithStats(ctx.schoolId));
    } catch (e: any) {
      setEvents([]);
      setError(e.message || 'Could not load events.');
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (ctxLoading || (ctx && events === null)) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={44} radius={22} />
          <Skeleton height={170} radius={20} />
          <Skeleton height={170} radius={20} />
        </View>
      </Screen>
    );
  }

  if (!ctx || !canManageFees(ctx)) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Not available" message="Events and Fees is managed by the school owner and authorised teacher admins." />
      </Screen>
    );
  }

  if (!getSchoolAccessStatus(ctx.school).active) {
    return (
      <Screen>
        <EmptyState icon="lock" title="Subscription needed" message="Renew the subscription to continue using Events and Fees." />
        <Button title="Open subscription" onPress={() => navigation.navigate('Subscription')} />
      </Screen>
    );
  }

  const all = events || [];
  const list = filter === 'all' ? all : all.filter(e => e.status === filter);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Notice message={error} tone="error" />
        <Pressable onPress={() => navigation.navigate('PaymentHistory')} style={styles.payShortcut}>
          <View style={styles.payIcon}>
            <Icon name="bank" size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[text.bodyStrong, { color: colors.text }]}>Payment history</Text>
            <Text style={[text.caption, { color: colors.textMuted }]}>See what Paystack has paid to your account</Text>
          </View>
          <Icon name="chevron" size={16} color={colors.textMuted} />
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map(f => (
            <Pressable key={f.value} onPress={() => setFilter(f.value)} style={[styles.chip, filter === f.value && styles.chipOn]}>
              <Text style={[text.small, styles.chipText, filter === f.value && { color: '#FFFFFF' }]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {list.length === 0 ? (
          <EmptyState
            icon="wallet"
            title={all.length === 0 ? 'No events yet' : 'No events here'}
            message={all.length === 0 ? 'Create an event to start tracking student payments.' : 'No events match this filter.'}
          />
        ) : (
          list.map(ev => {
            const pct = ev.stats.totalExpected > 0 ? Math.min(100, Math.round((ev.stats.totalCollected / ev.stats.totalExpected) * 100)) : 0;
            return (
              <Pressable key={ev.id} onPress={() => navigation.navigate('EventDetail', { eventId: ev.id })}>
                <Card style={{ marginBottom: spacing.md }}>
                  <View style={styles.top}>
                    <View style={{ flex: 1 }}>
                      <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={2}>{ev.name}</Text>
                      <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>{typeLabel(ev.event_type) + ' · ' + naira(Number(ev.amount)) + ' per student'}</Text>
                    </View>
                    <Badge label={String(ev.status).charAt(0).toUpperCase() + String(ev.status).slice(1)} tone={statusTone[ev.status] || 'blue'} />
                  </View>
                  <View style={styles.stats}>
                    <Stat label="Students" value={String(ev.stats.studentCount)} />
                    <Stat label="Expected" value={naira(ev.stats.totalExpected)} />
                    <Stat label="Collected" value={naira(ev.stats.totalCollected)} />
                  </View>
                  <View style={styles.out}>
                    <View>
                      <Text style={[text.h3, { color: ev.stats.totalOutstanding > 0 ? colors.danger : colors.success }]}>{naira(ev.stats.totalOutstanding)}</Text>
                      <Text style={[text.small, { color: colors.textMuted }]}>Outstanding</Text>
                    </View>
                    <Text style={[text.bodyStrong, { color: colors.primary }]}>{pct + '% collected'}</Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: (pct + '%') as any }]} />
                  </View>
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>
      <Fab label="New event" icon="plus" onPress={() => navigation.navigate('EventForm')} />
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={[text.small, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  payShortcut: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  payIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 120 },
  filters: { gap: spacing.sm, paddingBottom: spacing.lg },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: '#EEF1F6' },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, color: colors.textMuted },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  stats: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  out: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  track: { height: 8, borderRadius: 4, backgroundColor: '#E5E7EB', marginTop: spacing.sm, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
