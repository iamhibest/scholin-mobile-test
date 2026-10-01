import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';
import Icon from './Icon';

type Props = { checked: boolean; onChange: (next: boolean) => void; children: React.ReactNode };

export default function Checkbox({ checked, onChange, children }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(!checked)}
        hitSlop={8}
        style={[styles.box, checked && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        {checked ? <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.6} /> : null}
      </Pressable>
      <View style={styles.label}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.xl },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: '#C9CDD4', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  label: { flex: 1 },
});
