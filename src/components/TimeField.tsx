import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors, radius, spacing, text } from '../theme';
import Icon from './Icon';

type Props = { label: string; value: string; onChange: (hhmm: string) => void };

function pretty(v: string) {
  const [h, m] = v.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) {
    return v;
  }
  const suffix = h >= 12 ? 'PM' : 'AM';
  return (h % 12 || 12) + ':' + (m < 10 ? '0' + m : m) + ' ' + suffix;
}

export default function TimeField({ label, value, onChange }: Props) {
  const open = () => {
    const [h, m] = (value || '08:00').split(':').map(Number);
    const start = new Date();
    start.setHours(h || 0, m || 0, 0, 0);
    DateTimePickerAndroid.open({
      value: start,
      mode: 'time',
      is24Hour: false,
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          const hh = String(date.getHours()).padStart(2, '0');
          const mm = String(date.getMinutes()).padStart(2, '0');
          onChange(hh + ':' + mm);
        }
      },
    });
  };
  return (
    <View style={styles.wrap}>
      <Text style={[text.caption, styles.label]}>{label}</Text>
      <Pressable onPress={open} style={styles.field}>
        <Icon name="clock" size={20} color={colors.textMuted} />
        <Text style={[text.body, { flex: 1, color: colors.text }]}>{value ? pretty(value) : 'Select time'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { color: colors.textMuted, marginBottom: 6, letterSpacing: 0.3 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 54 },
});
