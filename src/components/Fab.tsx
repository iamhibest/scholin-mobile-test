import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing, text } from '../theme';
import Icon, { IconName } from './Icon';

type Props = { label: string; icon?: IconName; onPress: () => void };

export default function Fab({ label, icon = 'plus', onPress }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.fab, shadow.raised, { bottom: Math.max(insets.bottom, 16) + spacing.md }, pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] }]}>
      <Icon name={icon} size={20} color="#FFFFFF" strokeWidth={2.4} />
      <Text style={[text.bodyStrong, { color: '#FFFFFF' }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary, paddingHorizontal: 20, height: 52, borderRadius: radius.pill },
});
