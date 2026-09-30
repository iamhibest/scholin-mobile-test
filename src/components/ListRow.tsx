import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import Icon, { IconName } from './Icon';

type Props = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  tint?: string;
  iconColor?: string;
  onPress?: () => void;
};

export default function ListRow({ title, subtitle, icon, tint = colors.primarySoft, iconColor = colors.primary, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.background }]}>
      {icon ? (
        <View style={[styles.chip, { backgroundColor: tint }]}>
          <Icon name={icon} size={20} color={iconColor} />
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={[text.bodyStrong, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[text.small, { color: colors.textMuted }]}>{subtitle}</Text> : null}
      </View>
      {onPress ? <Icon name="chevron" size={20} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.md },
  chip: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
});
