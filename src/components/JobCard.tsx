import React, { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing, text } from '../theme';
import PressableScale from './PressableScale';
import { closingSoon, daysLeft, isNew, postedAgo, posterOf, snippet, Vacancy } from '../lib/vacancies';

const TINTS = [
  { bg: '#E8F0FF', fg: '#1A56DB' },
  { bg: '#E6F7EE', fg: '#13804A' },
  { bg: '#FFF1E0', fg: '#B45309' },
  { bg: '#F3E8FF', fg: '#7E22CE' },
  { bg: '#FDE8F0', fg: '#BE185D' },
  { bg: '#E0F5F5', fg: '#0F766E' },
];

export function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 997;
  }
  return TINTS[h % TINTS.length];
}

export function SchoolMark({ name, uri, size = 52 }: { name: string; uri?: string | null; size?: number }) {
  const tint = tintFor(name || 'S');
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: '#F3F4F6' }} resizeMode="cover" />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: tint.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: tint.fg, fontSize: size * 0.42, fontFamily: fonts.headingBold }}>{(name || 'S').trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

type Props = { vacancy: Vacancy; index: number; saved: boolean; onPress: () => void; onToggleSave: () => void };

export default function JobCard({ vacancy: v, index, saved, onPress, onToggleSave }: Props) {
  const enter = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 420, delay: Math.min(index, 8) * 70, useNativeDriver: true }).start();
  }, [enter, index]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (saved) {
      Animated.sequence([
        Animated.spring(pop, { toValue: 1.45, useNativeDriver: true, speed: 50, bounciness: 14 }),
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
      ]).start();
    }
  }, [saved, pop]);

  const poster = posterOf(v);
  const school = poster.name;
  const left = daysLeft(v);
  const urgent = closingSoon(v);

  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }] }}>
      <PressableScale onPress={onPress} style={styles.card}>
        <View style={styles.top}>
          <SchoolMark name={school} uri={poster.logo} />
          <View style={{ flex: 1 }}>
            <Text style={[text.bodyStrong, styles.title]} numberOfLines={2}>{v.title}</Text>
            <Text style={[text.small, styles.school]} numberOfLines={1}>{school}</Text>
          </View>
          <Pressable onPress={onToggleSave} hitSlop={12} style={styles.save}>
            <Animated.View style={{ transform: [{ scale: pop }] }}>
              <SaveGlyph on={saved} />
            </Animated.View>
          </Pressable>
        </View>

        <Text style={[text.small, styles.snippet]} numberOfLines={2}>{snippet(v.description)}</Text>

        <View style={styles.foot}>
          <View style={styles.tags}>
            {isNew(v) ? (
              <View style={[styles.tag, { backgroundColor: colors.successSoft }]}>
                <Text style={[styles.tagText, { color: colors.success }]}>New</Text>
              </View>
            ) : null}
            <View style={[styles.tag, { backgroundColor: urgent ? '#FFF1E0' : '#EEF1F6' }]}>
              <Text style={[styles.tagText, { color: urgent ? '#B45309' : colors.textMuted }]}>{left <= 1 ? 'Closes today' : 'Closes in ' + left + ' days'}</Text>
            </View>
            {v.apply_link ? (
              <View style={[styles.tag, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.tagText, { color: colors.primary }]}>Apply online</Text>
              </View>
            ) : null}
          </View>
          <Text style={[text.caption, { color: colors.textMuted }]}>{postedAgo(v.created_at)}</Text>
        </View>
      </PressableScale>
    </Animated.View>
  );
}

// A bookmark drawn from simple shapes so it can fill in when saved.
function SaveGlyph({ on }: { on: boolean }) {
  return (
    <View style={{ width: 22, height: 26, alignItems: 'center' }}>
      <View style={{ width: 18, height: 22, borderWidth: 2, borderColor: on ? colors.primary : '#9CA3AF', backgroundColor: on ? colors.primary : 'transparent', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
      <View style={{ position: 'absolute', bottom: 2, width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.surface }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: '#EEF1F6', shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { color: colors.text, fontSize: 16, lineHeight: 21 },
  school: { color: colors.primary, marginTop: 2, fontFamily: fonts.semibold },
  save: { padding: 4 },
  snippet: { color: colors.textMuted, marginTop: spacing.md, lineHeight: 19 },
  foot: { marginTop: spacing.md, gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  tagText: { fontSize: 11.5, fontFamily: fonts.semibold },
});
