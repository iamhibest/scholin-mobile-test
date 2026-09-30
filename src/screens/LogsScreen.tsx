import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, Screen } from '../components';
import { colors, spacing, text } from '../theme';
import { logger } from '../lib/logger';

export default function LogsScreen() {
  const [, tick] = useState(0);

  useEffect(() => logger.subscribe(() => tick(n => n + 1)), []);

  const items = logger.all();

  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: spacing.lg }}
        ListEmptyComponent={<EmptyState title="No logs yet" message="Errors and events from the app show here." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={[text.caption, { color: item.level === 'error' ? colors.danger : colors.textMuted }]}>{item.time}</Text>
            <Text style={[text.small, { color: colors.text }]}>{item.message}</Text>
          </View>
        )}
      />
      {items.length > 0 ? <Button title="Clear logs" variant="soft" onPress={logger.clear} style={{ margin: spacing.lg }} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
