import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Avatar, Card, EmptyState, Icon, Screen, SearchBar, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { fetchClassRoster } from '../lib/school';

export default function ClassReportCardsScreen({ navigation, route }: any) {
  const p = route.params;
  const [students, setStudents] = useState<any[] | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: 'Report Cards' });
    fetchClassRoster(p.classId, p.sessionId).then(setStudents).catch(() => setStudents([]));
  }, [p.classId, p.sessionId, navigation]);

  if (!students) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={48} radius={24} />
          <Skeleton height={72} radius={20} />
          <Skeleton height={72} radius={20} />
        </View>
      </Screen>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = students.filter(s => !q || s.full_name.toLowerCase().includes(q) || (s.admission_no || '').toLowerCase().includes(q));

  return (
    <Screen padded={false}>
      <FlatList
        data={shown}
        keyExtractor={s => s.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>{p.className + '  |  ' + p.termName + '. Tap a student to preview and generate their report card.'}</Text>
            <SearchBar value={query} onChange={setQuery} placeholder="Search students" />
          </View>
        }
        ListEmptyComponent={<EmptyState icon="users" title="No students in this class yet" />}
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('ReportCardView', { ...p, studentId: item.id, studentName: item.full_name })}>
            <View style={styles.row}>
              <Avatar name={item.full_name} uri={item.photo_url || undefined} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{item.full_name}</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{item.admission_no || 'No admission number'}</Text>
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
});
