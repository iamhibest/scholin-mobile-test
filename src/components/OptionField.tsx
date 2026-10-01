import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import BottomSheet from './BottomSheet';
import Icon from './Icon';

export type Option = { value: string; label: string };

type Props = { label: string; value: string; options: Option[]; placeholder?: string; hint?: string; compact?: boolean; onChange: (v: string) => void };

export default function OptionField({ label, value, options, placeholder = 'Select', hint, compact, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value);
  return (
    <View style={compact ? styles.compactWrap : styles.wrap}>
      <Text style={[text.caption, styles.label]}>{label}</Text>
      <Pressable onPress={() => setOpen(true)} style={[styles.field, compact && { height: 46 }]}>
        <Text style={[text.body, { flex: 1, color: current ? colors.text : '#9CA3AF' }]} numberOfLines={1}>{current ? current.label : placeholder}</Text>
        <Icon name="chevronDown" size={18} color={colors.textMuted} />
      </Pressable>
      {hint ? <Text style={[text.small, styles.hint]}>{hint}</Text> : null}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label}>
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          {options.map(o => {
            const active = o.value === value;
            return (
              <Pressable
                key={o.value || 'none'}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={[styles.option, active && { backgroundColor: colors.primarySoft }]}>
                <Text style={[text.body, { flex: 1, color: active ? colors.primary : colors.text, fontFamily: active ? text.bodyStrong.fontFamily : text.body.fontFamily }]}>{o.label}</Text>
                {active ? <Icon name="check" size={18} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  compactWrap: { flex: 1 },
  label: { color: colors.textMuted, marginBottom: 6, letterSpacing: 0.3 },
  field: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 54 },
  hint: { color: colors.textMuted, marginTop: 6 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.md, borderRadius: radius.md },
});
