import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, EmptyState, Icon, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { useStaff } from '../lib/useStaff';
import { classLabel, fetchTerms } from '../lib/school';

export default function MyClassesScreen({ navigation }: any) {
  const { ctx, loading: ctxLoading } = useStaff();
  const [items, setItems] = useState<any[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      const { data: classes, error } = await supabase.from('classes').select('id, name, arm, session_id').eq('school_id', ctx.schoolId).eq('class_teacher_id', ctx.userId);
      if (error) {
        throw error;
      }
      const list = (classes || []).slice().sort((a: any, b: any) => a.name.localeCompare(b.name));
      const ids = list.map((c: any) => c.id);
      const counts: Record<string, number> = {};
      const subjects: Record<string, string[]> = {};
      if (ids.length) {
        const [roster, subj] = await Promise.all([
          supabase.from('student_class_history').select('class_id').in('class_id', ids),
          supabase.from('class_subjects').select('class_id, subjects(name)').in('class_id', ids),
        ]);
        (roster.data || []).forEach((r: any) => {
          counts[r.class_id] = (counts[r.class_id] || 0) + 1;
        });
        (subj.data || []).forEach((r: any) => {
          if (r.subjects) {
            subjects[r.class_id] = [...(subjects[r.class_id] || []), r.subjects.name];
          }
        });
      }
      setItems(list.map((c: any) => ({ ...c, count: counts[c.id] || 0, subjects: subjects[c.id] || [] })));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = async (c: any) => {
    let term: any = null;
    try {
      const terms = await fetchTerms(c.session_id);
      term = terms.find((t: any) => t.is_current) || terms[terms.length - 1];
    } catch {}
    navigation.navigate('ClassDetail', { classId: c.id, sessionId: c.session_id, sessionName: '', termId: term ? term.id : '', termName: term ? term.name : '' });
  };

  if (ctxLoading || (!items && !failed)) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={96} radius={24} />
          <Skeleton height={96} radius={24} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={items || []}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListEmptyComponent={
          failed ? (
            <EmptyState icon="info" title="Could not load your classes" message="Pull down to try again." />
          ) : (
            <EmptyState icon="cap" title="No classes assigned yet" message="Your school admin needs to set you as the class teacher for a class before it shows up here." />
          )
        }
        renderItem={({ item }) => (
          <Card onPress={() => open(item)}>
            <View style={styles.row}>
              <View style={styles.chip}>
                <Icon name="cap" size={22} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.h3, { color: colors.text }]}>{classLabel(item)}</Text>
                <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={2}>{item.subjects.join(', ') || 'No subjects set for this class yet'}</Text>
                <Text style={[text.caption, { color: colors.primary, marginTop: 4 }]}>{item.count + (item.count === 1 ? ' student' : ' students')}</Text>
              </View>
              <Icon name="chevron" size={20} color={colors.textMuted} />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chip: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
