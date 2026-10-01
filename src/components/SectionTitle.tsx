import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import Icon from './Icon';

type Props = { title: string; subtitle?: string; action?: string; onAction?: () => void };

export default function SectionTitle({ title, subtitle, action, onAction }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={styles.bar} />
        <View style={{ flex: 1 }}>
          <Text style={[text.h2, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[text.small, { color: colors.textMuted }]}>{subtitle}</Text> : null}
        </View>
      </View>
      {action ? (
        <Pressable onPress={onAction} style={styles.action} hitSlop={6}>
          <Text style={[text.caption, { color: colors.success }]}>{action}</Text>
          <Icon name="chevron" size={14} color={colors.success} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xxl, marginBottom: spacing.md },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  bar: { width: 4, height: 24, borderRadius: 2, backgroundColor: colors.success },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: colors.successSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
});
