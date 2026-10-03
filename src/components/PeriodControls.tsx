import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import { monthOptions, PeriodType } from '../lib/admin';
import DateField from './DateField';
import OptionField from './OptionField';

const LABELS: Record<PeriodType, string> = { day: 'Day', week: 'Week', month: 'Month', term: 'Term', session: 'Session' };

type Props = {
  types: PeriodType[];
  type: PeriodType;
  onType: (t: PeriodType) => void;
  date: string;
  onDate: (d: string) => void;
  month: string;
  onMonth: (m: string) => void;
  termId: string;
  onTerm: (id: string) => void;
  terms: { id: string; name: string }[];
};

export default function PeriodControls({ types, type, onType, date, onDate, month, onMonth, termId, onTerm, terms }: Props) {
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {types.map(t => (
          <Pressable key={t} onPress={() => onType(t)} style={[styles.chip, type === t && styles.chipOn]}>
            <Text style={[text.bodyStrong, { color: type === t ? '#FFFFFF' : colors.textMuted }]}>{LABELS[t]}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {type === 'day' ? <DateField label="Date" value={date} onChange={onDate} clearable={false} /> : null}
      {type === 'week' ? <DateField label="Any day in the week" value={date} onChange={onDate} clearable={false} /> : null}
      {type === 'month' ? <OptionField label="Month" value={month} options={monthOptions()} onChange={onMonth} /> : null}
      {type === 'term' ? <OptionField label="Term" value={termId} options={terms.map(t => ({ value: t.id, label: t.name }))} onChange={onTerm} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: spacing.sm, paddingBottom: spacing.lg },
  chip: { paddingHorizontal: 18, height: 40, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
