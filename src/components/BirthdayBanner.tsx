import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ChevronRight } from 'lucide-react-native';
import { colors, spacing, text } from '../theme';
import { Birthday, namesText } from '../lib/birthdays';

function Cake({ size = 54 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect x="29" y="8" width="3" height="10" rx="1.5" fill="#6C63D9" />
      <Rect x="16" y="12" width="3" height="10" rx="1.5" fill="#3B82F6" />
      <Rect x="42" y="12" width="3" height="10" rx="1.5" fill="#3B82F6" />
      <Circle cx="30.5" cy="6" r="3" fill="#FFB020" />
      <Circle cx="17.5" cy="10" r="3" fill="#FFB020" />
      <Circle cx="43.5" cy="10" r="3" fill="#FFB020" />
      <Rect x="8" y="24" width="48" height="12" rx="5" fill="#FFFFFF" />
      <Rect x="8" y="30" width="48" height="26" rx="6" fill="#E5324B" />
      <Rect x="8" y="24" width="48" height="10" rx="5" fill="#FFFFFF" />
    </Svg>
  );
}

const DOTS: Array<[number, number, string]> = [
  [8, 14, '#3B82F6'], [20, 6, '#F472B6'], [6, 44, '#FFB020'], [58, 10, '#FFB020'], [62, 30, '#3B82F6'], [26, 50, '#F43F5E'],
];

// Wishes on the day, a heads up the day before, and a nudge when one is close.
export default function BirthdayBanner({ today, tomorrow, tomorrowLabel, soon, onPress }: { today: Birthday[]; tomorrow: Birthday[]; tomorrowLabel: string; soon?: Birthday[]; onPress: () => void }) {
  const near = soon || [];
  if (!today.length && !tomorrow.length && !near.length) {
    return null;
  }
  const celebrating = today.length > 0;
  const reminding = !celebrating && tomorrow.length > 0;
  const gold = celebrating;
  const fg = gold ? '#8A5A00' : '#E11D48';
  const pill = gold ? '#F5A623' : '#F43F5E';
  const grad: [string, string] = gold ? ['#FFF3CC', '#FFE3A3'] : ['#FFE4EA', '#FFF1F4'];
  const title = celebrating ? 'Happy Birthday!' : reminding ? 'Birthday Reminder' : 'Birthday Coming Up';
  let body = '';
  if (celebrating) {
    body = namesText(today) + (today.length === 1 ? ', wishing you' : ', wishing you all') + ' a wonderful birthday today!';
  } else if (reminding) {
    body = namesText(tomorrow) + (tomorrow.length === 1 ? ' is' : ' are') + ' celebrating ' + (tomorrow.length === 1 ? 'a birthday' : 'birthdays') + ' tomorrow (' + tomorrowLabel + ').';
  } else {
    body = namesText(near) + (near.length === 1 ? ' has' : ' have') + ' a birthday on ' + near[0].dateLabel + '.';
  }

  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={grad[0]} />
            <Stop offset="1" stopColor={grad[1]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#bg)" />
      </Svg>
      <View style={styles.art}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 70 64">
          <G>{DOTS.map((d, i) => <Circle key={i} cx={d[0]} cy={d[1]} r={2.2} fill={d[2]} />)}</G>
        </Svg>
        <Cake />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.pill, { backgroundColor: pill }]}>{title}</Text>
        <Text style={[text.bodyStrong, { color: colors.text, marginTop: 6 }]} numberOfLines={3}>{body}</Text>
        {celebrating && tomorrow.length ? (
          <Text style={[text.caption, { color: fg, marginTop: 3 }]} numberOfLines={1}>{'Tomorrow: ' + namesText(tomorrow)}</Text>
        ) : null}
      </View>
      <ChevronRight size={22} color={fg} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: 20, paddingVertical: 14, paddingHorizontal: spacing.md, overflow: 'hidden' },
  art: { width: 70, height: 64, alignItems: 'center', justifyContent: 'center' },
  pill: { alignSelf: 'flex-start', color: '#FFFFFF', fontSize: 12, fontWeight: '700', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
});
