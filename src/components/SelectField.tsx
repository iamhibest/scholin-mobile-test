import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import BottomSheet from './BottomSheet';
import Icon from './Icon';
import ListRow from './ListRow';

type Props = { label: string; value: string; options: string[]; placeholder?: string; hint?: string; onChange: (v: string) => void };

export default function SelectField({ label, value, options, placeholder = 'Select', hint, onChange }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={[text.caption, styles.label]}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={styles.field}>
        <Text style={[text.body, { flex: 1, color: value ? colors.text : '#9CA3AF' }]}>{value || placeholder}</Text>
        <Icon name="chevron" size={20} color={colors.textMuted} />
      </Pressable>
      {hint ? <Text style={[text.small, styles.hint]}>{hint}</Text> : null}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <ScrollView style={{ maxHeight: 360 }}>
          {options.map(o => (
            <ListRow
              key={o}
              title={o}
              onPress={() => {
                onChange(o);
                setOpen(false);
              }}
            />
          ))}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { color: colors.textMuted, marginBottom: 6, letterSpacing: 0.3 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 54 },
  hint: { color: colors.textMuted, marginTop: 6 },
});
