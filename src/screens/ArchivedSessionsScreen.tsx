import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, EmptyState, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { fetchSessionsWithTerms, setArchived } from '../lib/admin';

export default function ArchivedSessionsScreen() {
  const { ctx, loading: ctxLoading } = useStaff();
  const [list, setList] = useState<any[] | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      setList(await fetchSessionsWithTerms(ctx.schoolId, true));
    } catch (e: any) {
      setList([]);
      setMessage(e.message);
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const unarchive = async (id: string) => {
    try {
      await setArchived(id, false);
      await load();
    } catch (e: any) {
      setMessage(e.message);
    }
  };

  if (ctxLoading || !list) {
    return (
      <Screen>
        <Skeleton height={80} radius={20} />
      </Screen>
    );
  }

  if (ctx && !ctx.isAdmin) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Admins only" message="Only the school owner and teacher admins can see archived sessions." />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={list}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={<Notice message={message} />}
        ListEmptyComponent={<EmptyState icon="layers" title="No archived sessions" message="Sessions you archive will appear here." />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={[text.h3, { color: colors.text, flex: 1 }]}>{item.name}</Text>
              <Button title="Unarchive" variant="soft" onPress={() => unarchive(item.id)} style={{ height: 42, paddingHorizontal: 16 }} />
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
