import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar, Badge, Card, EmptyState, Fab, OptionField, Screen, SearchBar, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { classLabel, fetchClasses, fetchSessions, fetchStudentRoster, SchoolClass, Student } from '../lib/school';

export default function StudentsScreen({ navigation }: any) {
  const { ctx, loading: ctxLoading } = useStaff();
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [query, setQuery] = useState('');
  const [roster, setRoster] = useState<{ students: Student[]; assign: Record<string, string>; linked: Set<string> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ctx || !ctx.isAdmin) {
      return;
    }
    fetchSessions(ctx.schoolId)
      .then(list => {
        setSessions(list);
        const current = list.find((s: any) => s.is_current) || list[0];
        setSessionId(current ? current.id : '');
        if (!current) {
          setLoading(false);
        }
      })
      .catch(() => {
        setFailed(true);
        setLoading(false);
      });
  }, [ctx]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    setClassId('');
    fetchClasses(sessionId).then(setClasses).catch(() => setClasses([]));
  }, [sessionId]);

  const loadRoster = useCallback(async () => {
    if (!ctx || !sessionId) {
      return;
    }
    try {
      setFailed(false);
      setRoster(await fetchStudentRoster(ctx.schoolId, sessionId));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ctx, sessionId]);

  useFocusEffect(
    useCallback(() => {
      loadRoster();
    }, [loadRoster]),
  );

  const classNames = useMemo(() => {
    const map: Record<string, string> = {};
    classes.forEach(c => {
      map[c.id] = classLabel(c);
    });
    return map;
  }, [classes]);

  const visible = useMemo(() => {
    if (!roster) {
      return [];
    }
    const q = query.trim().toLowerCase();
    return roster.students.filter(s => {
      if (classId && roster.assign[s.id] !== classId) {
        return false;
      }
      if (!q) {
        return true;
      }
      return s.full_name.toLowerCase().includes(q) || (s.admission_no || '').toLowerCase().includes(q);
    });
  }, [roster, query, classId]);

  if (!ctxLoading && ctx && !ctx.isAdmin) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Admins only" message="Only the school owner and teacher admins can manage students." />
      </Screen>
    );
  }

  const sessionOptions = sessions.map(s => ({ value: s.id, label: s.name + (s.is_current ? ' (Current)' : '') }));
  const classOptions = [{ value: '', label: 'All students' }, ...classes.map(c => ({ value: c.id, label: classLabel(c) }))];

  const header = (
    <View>
      <View style={styles.filters}>
        <OptionField compact label="Session" value={sessionId} options={sessionOptions} placeholder="Session" onChange={setSessionId} />
        <OptionField compact label="Class" value={classId} options={classOptions} placeholder="All students" onChange={setClassId} />
      </View>
      <View style={{ marginTop: spacing.md }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Search by name or admission number" />
      </View>
      {roster ? (
        <Text style={[text.small, styles.count]}>{visible.length + (visible.length === 1 ? ' student' : ' students')}</Text>
      ) : null}
    </View>
  );

  if (ctxLoading || loading) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={70} radius={16} />
          <Skeleton height={48} radius={24} />
          <Skeleton height={84} radius={20} />
          <Skeleton height={84} radius={20} />
          <Skeleton height={84} radius={20} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList renderScrollComponent={(sp: any) => <ScrollView {...sp} />}
        data={visible}
        keyExtractor={s => s.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRoster(); }} tintColor={colors.primary} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          failed ? (
            <EmptyState icon="info" title="Could not load students" message="Check your connection and pull down to try again." />
          ) : (
            <EmptyState
              icon="users"
              title={query || classId ? 'No matching students' : 'No students yet'}
              message={query || classId ? 'Try a different search or choose another class.' : 'Add your first student to get started.'}
            />
          )
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('StudentDetail', { studentId: item.id, sessionId })}>
            <View style={styles.row}>
              <Avatar name={item.full_name} uri={item.photo_url || undefined} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{item.full_name}</Text>
                <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>
                  {(item.admission_no || 'No admission number') + (item.gender ? '  |  ' + item.gender : '')}
                </Text>
                <View style={styles.tags}>
                  <Badge label={classNames[roster ? roster.assign[item.id] : ''] || 'Not assigned'} tone={roster && roster.assign[item.id] ? 'blue' : 'purple'} />
                  {roster && !roster.linked.has(item.id) ? <Badge label="No parent linked" tone="orange" /> : null}
                </View>
              </View>
            </View>
          </Card>
        )}
      />
      <Fab label="Add student" onPress={() => navigation.navigate('StudentForm', { sessionId })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 120 },
  filters: { flexDirection: 'row', gap: spacing.md },
  count: { color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
});
