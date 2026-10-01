import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { colors, radius, spacing, text } from '../theme';
import { isoToDisplay } from '../lib/date';
import { toISODateLocal } from '../lib/format';
import Icon from './Icon';

type Props = { label: string; value: string; onChange: (iso: string) => void; maximumDate?: Date; placeholder?: string };

export default function DateField({ label, value, onChange, maximumDate, placeholder = 'Select date' }: Props) {
  const open = () => {
    const start = value ? new Date(value + 'T00:00:00') : new Date(2015, 0, 1);
    DateTimePickerAndroid.open({
      value: start,
      mode: 'date',
      maximumDate: maximumDate || new Date(),
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          onChange(toISODateLocal(date));
        }
      },
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={[text.caption, styles.label]}>{label}</Text>
      <Pressable onPress={open} style={styles.field}>
        <Icon name="calendar" size={20} color={colors.textMuted} />
        <Text style={[text.body, { flex: 1, color: value ? colors.text : '#9CA3AF' }]}>{value ? isoToDisplay(value) : placeholder}</Text>
        {value ? (
          <Pressable onPress={() => onChange('')} hitSlop={10}>
            <Icon name="close" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { color: colors.textMuted, marginBottom: 6, letterSpacing: 0.3 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 54 },
});
