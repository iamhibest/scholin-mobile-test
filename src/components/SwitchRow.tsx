import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { colors, spacing, text } from '../theme';

type Props = { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean };

export default function SwitchRow({ label, desc, value, onChange, disabled }: Props) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[text.bodyStrong, { color: colors.text }]}>{label}</Text>
        {desc ? <Text style={[text.small, { color: colors.textMuted }]}>{desc}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: '#D5D8DE', true: colors.primaryLight }} thumbColor={value ? colors.primary : '#FFFFFF'} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
});
