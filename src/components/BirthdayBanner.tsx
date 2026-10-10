import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { ChevronRight } from 'lucide-react-native';
import { colors, spacing, text } from '../theme';
import { Birthday, namesText } from '../lib/birthdays';

function Cake({ size = 52 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x="29" y="8" width="3" height="10" rx="1.5" fill="#6C63D9" />
      <Rect x="16" y="12" width="3" height="10" rx="1.5" fill="#3B82F6" />
      <Rect x="42" y="12" width="3" height="10" rx="1.5" fill="#3B82F6" />
      <Circle cx="30.5" cy="6" r="3" fill="#FFB020" />
      <Circle cx="17.5" cy="10" r="3" fill="#FFB020" />
      <Circle cx="43.5" cy="10" r="3" fill="#FFB020" />
      <Rect x="8" y="30" width="48" height="26" rx="6" fill="#E5324B" />
      <Rect x="8" y="24" width="48" height="10" rx="5" fill="#FFFFFF" />
    </Svg>
  );
}

const TONES = {
  gold: { bg: '#FFF1C9', border: '#F5D27A', pill: '#F5A623', fg: '#8A5A00' },
  pink: { bg: '#FFE6EC', border: '#F9C0CD', pill: '#F43F5E', fg: '#E11D48' },
};

// One banner shape for everyone. The text is kept to two lines with an ellipsis, so it can never spill out of the card.
// The full message is on the page it opens.
export function BirthdayBannerCard({ tone, title, body, onPress }: { tone: 'gold' | 'pink'; title: string; body: string; onPress: () => void }) {
  const t = TONES[tone];
  return (
    <Pressable onPress={onPress} style={[styles.wrap, { backgroundColor: t.bg, borderColor: t.border }]}>
      <View style={styles.art}>
        <Cake />
      </View>
      <View style={styles.middle}>
        <Text style={[styles.pill, { backgroundColor: t.pill }]} numberOfLines={1}>{title}</Text>
        <Text style={[text.bodyStrong, { color: colors.text, marginTop: 6 }]} numberOfLines={2} ellipsizeMode="tail">{body}</Text>
        <Text style={[text.caption, { color: t.fg, marginTop: 3 }]} numberOfLines={1}>Tap to read more</Text>
      </View>
      <ChevronRight size={22} color={t.fg} />
    </Pressable>
  );
}

// Staff dashboard banner (school owner, teacher admin and teacher).
export default function BirthdayBanner({ today, tomorrow, tomorrowLabel, soon, onPress }: { today: Birthday[]; tomorrow: Birthday[]; tomorrowLabel: string; soon?: Birthday[]; onPress: () => void }) {
  const near = soon || [];
  if (!today.length && !tomorrow.length && !near.length) {
    return null;
  }
  if (today.length > 0) {
    return (
      <BirthdayBannerCard
        tone="gold"
        title="Happy Birthday!"
        body={namesText(today) + (today.length === 1 ? ' is celebrating a birthday today.' : ' are celebrating birthdays today.')}
        onPress={onPress}
      />
    );
  }
  if (tomorrow.length > 0) {
    return (
      <BirthdayBannerCard
        tone="pink"
        title="Birthday Reminder"
        body={namesText(tomorrow) + (tomorrow.length === 1 ? ' is' : ' are') + ' celebrating ' + (tomorrow.length === 1 ? 'a birthday' : 'birthdays') + ' tomorrow (' + tomorrowLabel + ').'}
        onPress={onPress}
      />
    );
  }
  return (
    <BirthdayBannerCard
      tone="pink"
      title="Birthday Coming Up"
      body={namesText(near) + (near.length === 1 ? ' has' : ' have') + ' a birthday on ' + near[0].dateLabel + '.'}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: 20, borderWidth: 1, paddingVertical: 14, paddingHorizontal: spacing.md },
  art: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  middle: { flex: 1, minWidth: 0 },
  pill: { alignSelf: 'flex-start', color: '#FFFFFF', fontSize: 12, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
});
