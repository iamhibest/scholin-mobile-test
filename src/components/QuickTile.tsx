import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, text } from '../theme';
import Icon, { IconName } from './Icon';

type Tone = 'green' | 'blue' | 'purple' | 'pink' | 'amber' | 'teal' | 'rose' | 'gold';

export const toneColors: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: '#E5F5E7', fg: '#1E7A29' },
  blue: { bg: '#E9F0FD', fg: '#1857D6' },
  purple: { bg: '#EFEDFC', fg: '#6A5BD6' },
  pink: { bg: '#FCE8F1', fg: '#C2307A' },
  amber: { bg: '#FDF1E4', fg: '#C8691E' },
  teal: { bg: '#E0F4F3', fg: '#12807A' },
  rose: { bg: '#FCE8E6', fg: '#D42A1F' },
  gold: { bg: '#FBF3D9', fg: '#A47A0A' },
};

type Props = { label: string; icon: IconName; tone: Tone; onPress?: () => void; width?: number | string };

export default function QuickTile({ label, icon, tone, onPress, width = '31%' }: Props) {
  const t = toneColors[tone];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, shadow.soft, { width: width as any }, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}>
      <View style={[styles.chip, { backgroundColor: t.bg }]}>
        <Icon name={icon} size={24} color={t.fg} />
      </View>
      <Text style={[text.caption, styles.label]} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingVertical: spacing.lg, paddingHorizontal: spacing.sm, alignItems: 'center' },
  chip: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.text, textAlign: 'center', marginTop: spacing.sm, minHeight: 32 },
});
