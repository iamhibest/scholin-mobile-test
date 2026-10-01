import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, shadow, text } from '../theme';
import Icon, { IconName } from './Icon';

type Variant = 'primary' | 'soft' | 'ghost' | 'danger' | 'outline';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: ViewStyle;
};

const palette: Record<Variant, { bg: string; fg: string }> = {
  primary: { bg: colors.primary, fg: colors.textOnPrimary },
  soft: { bg: colors.primarySoft, fg: colors.primary },
  ghost: { bg: 'transparent', fg: colors.primary },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  outline: { bg: colors.surface, fg: colors.primary },
};

export default function Button({ title, onPress, variant = 'primary', loading, disabled, icon, style }: Props) {
  const p = palette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: p.bg, opacity: inactive ? 0.55 : pressed ? 0.88 : 1 },
        variant === 'primary' && shadow.raised,
        variant === 'outline' && { borderWidth: 1.5, borderColor: colors.primary },
        pressed && { transform: [{ scale: 0.985 }] },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          <Text style={[text.button, { color: p.fg }]}>{title}</Text>
          {icon ? <Icon name={icon} size={20} color={p.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
