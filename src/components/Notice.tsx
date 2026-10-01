import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import Icon from './Icon';

type Props = { message: string; tone?: 'error' | 'success' };

export default function Notice({ message, tone = 'error' }: Props) {
  if (!message) {
    return null;
  }
  const ok = tone === 'success';
  const fg = ok ? colors.success : colors.danger;
  return (
    <View style={[styles.box, { backgroundColor: ok ? colors.successSoft : colors.dangerSoft }]}>
      <Icon name={ok ? 'check' : 'info'} size={18} color={fg} />
      <Text style={[text.small, styles.msg, { color: fg }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.lg, alignItems: 'flex-start' },
  msg: { flex: 1 },
});
