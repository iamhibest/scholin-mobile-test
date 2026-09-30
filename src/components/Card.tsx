import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

type Props = { children: React.ReactNode; onPress?: () => void; tint?: string; style?: ViewStyle };

export default function Card({ children, onPress, tint, style }: Props) {
  const base = [styles.card, shadow.soft, tint ? { backgroundColor: tint } : null, style];
  if (!onPress) {
    return <View style={base}>{children}</View>;
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.92 }]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg },
});
