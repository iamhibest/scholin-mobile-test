import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, EmptyState, Notice, OptionField, Screen, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { fetchResultsStatus } from '../lib/staffTools';

function Tag({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: ok ? colors.successSoft : '#FFF1E0' }]}>
      <Text style={[styles.tagText, { color: ok ? colors.success : '#B45309' }]}>{ok ? yes : no}</Text>
    </View>
  );
}

function Ring({ done, total }: { done: number; total: number }) {
  const fill = useRef(new Animated.Value(0)).current;
  const pct = total > 0 ? done / total : 0;
  useEffect(() => {
    Animated.timing(fill, { toValue: pct, duration: 800, useNativeDriver: false }).start();
  }, [pct, fill]);
  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width, backgroundColor: pct >= 1 ? colors.success : colors.primary }]} />
    </View>
  );
}

export default function ResultsStatusScreen() {
  const { ctx, loading: ctxLoading } = useStaff();
  const [data, setData] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      setError('');
      setData(await fetchResultsStatus(ctx.schoolId, ctx.userId));
    } catch (e: any) {
      setData({ state: 'ok', classes: [] });
      setError(e.message || 'Could not load results status right now.');
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (ctxLoading || (ctx && !data)) {
    return (
      <Screen>
        <Skeleton height={120} radius={24} />
        <Skeleton height={200} radius={20} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (data && data.state === 'no_classes') {
    return (
      <Screen>
        <EmptyState icon="cap" title="No classes assigned yet" message="Your school admin needs to set you as the class teacher for a class before results status can show here." />
      </Screen>
    );
  }
  if (data && data.state === 'no_term') {
    return (
      <Screen>
        <EmptyState icon="calendar" title="No current term set up yet" message="Your school admin needs to mark a session and term as current before results status can be tracked." />
      </Screen>
    );
  }

  const classes: any[] = data ? data.classes : [];
  const show = filter === 'all' ? classes : classes.filter(c => c.id === filter);
  let total = 0;
  let done = 0;
  show.forEach(c => {
    total += c.students.length;
    done += c.students.filter((s: any) => s.complete).length;
  });
  const complete = total > 0 && done === total;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Notice message={error} tone="error" />
        {classes.length > 1 ? <OptionField label="Class" value={filter} options={[{ value: 'all', label: 'All my classes' }].concat(classes.map(c => ({ value: c.id, label: c.label })))} onChange={setFilter} /> : null}

        <View style={[styles.hero, { backgroundColor: complete ? '#13804A' : colors.primary }]}>
          <Text style={styles.heroNumber}>{done + ' of ' + total}</Text>
          <Text style={styles.heroLabel}>results published</Text>
          <View style={{ marginTop: spacing.md }}>
            <Ring done={done} total={total} />
          </View>
          <Text style={styles.heroSub}>{complete ? 'Every result here has been published for school admin to verify.' : 'The rest still need to be entered and published.'}</Text>
        </View>

        {show.map(c => {
          const pending = c.students.filter((s: any) => !s.complete);
          return (
            <Card key={c.id} style={{ marginBottom: spacing.md }}>
              <View style={styles.between}>
                <Text style={[text.bodyStrong, { color: colors.text }]}>{c.label}</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{c.students.length + (c.students.length === 1 ? ' student' : ' students')}</Text>
              </View>

              <Text style={styles.section}>Subjects</Text>
              {c.subjects.length === 0 ? <Text style={[text.small, { color: colors.textMuted }]}>No subjects assigned to this class yet.</Text> : null}
              {c.subjects.map((s: any) => (
                <View key={s.id} style={styles.line}>
                  <Text style={[text.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>{s.name}</Text>
                  <Tag ok={s.published} yes="Published" no="Not published" />
                </View>
              ))}

              {c.students.length > 0 ? <Text style={styles.section}>Students</Text> : null}
              {c.students.map((s: any) => (
                <View key={s.id} style={styles.line}>
                  <Text style={[text.body, { color: colors.text, flex: 1 }]} numberOfLines={1}>{s.name}</Text>
                  <Tag ok={s.complete} yes="Published" no="Pending" />
                </View>
              ))}
              {pending.length > 0 ? <Text style={[text.small, { color: colors.danger, marginTop: spacing.md }]}>{pending.length + (pending.length === 1 ? ' student still missing a published result here.' : ' students still missing a published result here.')}</Text> : null}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  hero: { borderRadius: radius.xl, padding: spacing.xl, marginBottom: spacing.lg },
  heroNumber: { color: '#FFFFFF', fontSize: 36, lineHeight: 42, fontFamily: fonts.headingBold },
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: fonts.semibold },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: spacing.md, fontFamily: fonts.body },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { fontSize: 11.5, letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted, marginTop: spacing.lg, marginBottom: 6, fontFamily: fonts.semibold },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  tagText: { fontSize: 11.5, fontFamily: fonts.semibold },
});
