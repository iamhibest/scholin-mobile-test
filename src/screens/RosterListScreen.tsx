import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { EmptyState, Notice, Screen, SearchBar, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { getSchoolAccessStatus } from '../lib/dashboard';
import { fetchRosterStaff, fetchRosterStudents } from '../lib/account';

export default function RosterListScreen({ navigation, route }: any) {
  const kind: 'students' | 'staff' = route.params && route.params.type === 'staff' ? 'staff' : 'students';
  const { ctx, loading: ctxLoading } = useStaff();
  const [rows, setRows] = useState<{ name: string; sub: string }[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: kind === 'staff' ? 'All staff' : 'All students' });
  }, [navigation, kind]);

  useEffect(() => {
    if (!ctx) {
      return;
    }
    (kind === 'staff' ? fetchRosterStaff(ctx.schoolId) : fetchRosterStudents(ctx.schoolId))
      .then(setRows)
      .catch(e => {
        setRows([]);
        setError(e.message);
      });
  }, [ctx, kind]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows || []).filter(r => !q || r.name.toLowerCase().includes(q));
  }, [rows, query]);

  if (ctxLoading || (ctx && rows === null)) {
    return (
      <Screen>
        <Skeleton height={50} radius={25} />
        <Skeleton height={64} radius={16} style={{ marginTop: spacing.lg }} />
        <Skeleton height={64} radius={16} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  if (ctx && !getSchoolAccessStatus(ctx.school).active) {
    return (
      <Screen>
        <EmptyState icon="lock" title="Subscription needed" message="Renew the subscription to see this list." />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList renderScrollComponent={(sp: any) => <ScrollView {...sp} />}
        data={list}
        keyExtractor={(r, i) => r.name + i}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>{(rows || []).length + (kind === 'staff' ? ' active staff' : ' enrolled students')}</Text>
            <SearchBar value={query} onChange={setQuery} placeholder="Search by name" />
            <Notice message={error} tone="error" />
          </View>
        }
        ListEmptyComponent={<EmptyState icon="users" title={query ? 'No matches found' : kind === 'staff' ? 'No staff yet' : 'No students yet'} message={query ? 'Try a different name.' : 'Nothing to show here yet.'} />}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <View style={styles.num}>
              <Text style={styles.numText}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>{item.sub}</Text>
            </View>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: '#EEF1F6' },
  num: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  numText: { color: colors.primary, fontSize: 12.5, fontFamily: fonts.bold },
});
