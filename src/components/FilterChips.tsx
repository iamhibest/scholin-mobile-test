import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';

export default function FilterChips({ options, value, onChange }: { options: { key: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.label, on && styles.labelOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  label: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  labelOn: { color: '#FFFFFF' },
});
