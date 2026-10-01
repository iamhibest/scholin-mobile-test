import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Card, EmptyState, Fab, Icon, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { classLabel, fetchClasses, SchoolClass } from '../lib/school';

export default function PortalClassesScreen({ navigation, route }: any) {
  const { sessionId, sessionName, termId, termName } = route.params;
  const { ctx } = useStaff();
  const [items, setItems] = useState<SchoolClass[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchClasses(sessionId));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setRefreshing(false);
    }
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!items && !failed) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={86} radius={24} />
          <Skeleton height={86} radius={24} />
          <Skeleton height={86} radius={24} />
        </View>
      </Screen>
    );
  }

  const isAdmin = !!ctx && ctx.isAdmin;

  return (
    <Screen padded={false}>
      <FlatList
        data={items || []}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            <Text style={[text.h2, { color: colors.primary }]}>{termName + ' classes'}</Text>
            <Text style={[text.small, { color: colors.textMuted }]}>{sessionName}</Text>
          </View>
        }
        ListEmptyComponent={
          failed ? (
            <EmptyState icon="info" title="Could not load classes" message="Pull down to try again." />
          ) : (
            <EmptyState icon="cap" title="No classes yet" message={isAdmin ? 'Add your first class to get started.' : 'Your school admin needs to add classes for this session.'} />
          )
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('ClassDetail', { classId: item.id, sessionId, sessionName, termId, termName })}>
            <View style={styles.row}>
              <View style={styles.chip}>
                <Icon name="cap" size={22} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.h3, { color: colors.text }]}>{classLabel(item)}</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{'Class teacher: ' + (item.class_teacher ? item.class_teacher.full_name : 'Not assigned')}</Text>
              </View>
              <Icon name="chevron" size={20} color={colors.textMuted} />
            </View>
          </Card>
        )}
      />
      {isAdmin ? <Fab label="Add class" onPress={() => navigation.navigate('ClassForm', { sessionId })} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 120 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chip: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center' },
});
