import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Cake, ChevronRight } from 'lucide-react-native';
import { colors, spacing, text } from '../theme';
import { Birthday, namesText } from '../lib/birthdays';

// A compact reminder: wishes on the day, and a heads up the day before.
export default function BirthdayBanner({ today, tomorrow, tomorrowLabel, onPress }: { today: Birthday[]; tomorrow: Birthday[]; tomorrowLabel: string; onPress: () => void }) {
  if (!today.length && !tomorrow.length) {
    return null;
  }
  const celebrating = today.length > 0;
  const bg = celebrating ? '#FFF4D6' : '#FFE8EE';
  const fg = celebrating ? '#8A5A00' : '#B4233F';
  const solid = celebrating ? '#F5A623' : '#E5456B';
  const title = celebrating ? 'Happy Birthday!' : 'Birthday Reminder';
  const body = celebrating
    ? namesText(today) + (today.length === 1 ? ', wishing you' : ', wishing you all') + ' a wonderful birthday today.'
    : namesText(tomorrow) + (tomorrow.length === 1 ? ' is' : ' are') + ' celebrating ' + (tomorrow.length === 1 ? 'a birthday' : 'birthdays') + ' tomorrow (' + tomorrowLabel + ').';

  return (
    <Pressable onPress={onPress} style={[styles.wrap, { backgroundColor: bg }]}>
      <View style={[styles.icon, { backgroundColor: solid }]}>
        <Cake size={19} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: fg }]}>{title}</Text>
        <Text style={[text.small, { color: colors.text }]} numberOfLines={2}>{body}</Text>
        {celebrating && tomorrow.length ? (
          <Text style={[text.caption, { color: fg, marginTop: 2 }]} numberOfLines={1}>{'Tomorrow: ' + namesText(tomorrow)}</Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: 18, paddingVertical: 10, paddingHorizontal: spacing.md },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 12, fontWeight: '700', marginBottom: 1 },
});
