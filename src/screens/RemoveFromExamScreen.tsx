import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar, Button, Card, EmptyState, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { confirmAction } from '../lib/confirm';
import { fetchClassRoster } from '../lib/school';
import { removeStudentFromExam } from '../lib/portal';

export default function RemoveFromExamScreen({ route }: any) {
  const { classId, sessionId, termId, termName } = route.params;
  const [roster, setRoster] = useState<any[] | null>(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  useFocusEffect(
    useCallback(() => {
      fetchClassRoster(classId, sessionId).then(setRoster).catch(e => {
        setRoster([]);
        setNotice({ message: e.message, tone: 'error' });
      });
    }, [classId, sessionId]),
  );

  const remove = (s: any) => {
    confirmAction(
      'Remove from exam',
      "Delete all of " + s.full_name + "'s scores for " + termName + ' in this class? This cannot be undone.',
      'Remove',
      async () => {
        setBusy(s.id);
        try {
          await removeStudentFromExam(s.id, termId, classId);
          setNotice({ message: s.full_name + " was removed from this term's exam.", tone: 'success' });
        } catch (e: any) {
          setNotice({ message: e.message, tone: 'error' });
        }
        setBusy('');
      },
    );
  };

  if (!roster) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={76} radius={20} />
          <Skeleton height={76} radius={20} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={roster}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={
          <View>
            <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>Removing a student deletes their scores for this term in this class.</Text>
            <Notice message={notice.message} tone={notice.tone} />
          </View>
        }
        ListEmptyComponent={<EmptyState icon="users" title="No students in this class yet" message="Assign students to this class first." />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Avatar name={item.full_name} uri={item.photo_url || undefined} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{item.full_name}</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{item.admission_no || 'No admission number'}</Text>
              </View>
              <Button title="Remove" variant="danger" loading={busy === item.id} onPress={() => remove(item)} style={{ height: 40, paddingHorizontal: 14 }} />
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
