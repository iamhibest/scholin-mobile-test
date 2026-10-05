import React, { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing, text } from '../theme';
import PressableScale from './PressableScale';
import Icon from './Icon';
import { categoryLabel, closingSoon, deadlineLabel, isNew, jobTypeLabel, postedAgo, posterOf, snippet, Vacancy } from '../lib/vacancies';

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

export const VGREEN = { dark: '#0F4A3A', mid: '#1F6B45', soft: '#E6F1EA', pill: '#DDF0E4', ink: '#12352B' };

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
  const urgent = closingSoon(v);

  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }] }}>
      <PressableScale onPress={onPress} style={styles.card}>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>{v.title}</Text>
            {!poster.personal ? <Text style={styles.school} numberOfLines={1}>{poster.name}</Text> : null}
            {poster.person ? <Text style={styles.by} numberOfLines={1}>{'Posted by ' + poster.person}</Text> : null}
          </View>
          <View style={styles.cat}>
            <Text style={styles.catText} numberOfLines={1}>{categoryLabel(v.category)}</Text>
          </View>
        </View>

        <View style={styles.meta}>
          {v.location ? (
            <View style={styles.metaItem}>
              <Icon name="pin" size={14} color={colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>{v.location}</Text>
            </View>
          ) : null}
          <Text style={styles.metaText} numberOfLines={1}>{jobTypeLabel(v.job_type)}</Text>
        </View>

        <Text style={styles.snippet} numberOfLines={2}>{snippet(v.description)}</Text>

        <View style={styles.foot}>
          <View style={[styles.deadline, urgent && { backgroundColor: '#FFF1E0' }]}>
            <Text style={[styles.deadlineText, urgent && { color: '#B45309' }]} numberOfLines={1}>{'Deadline: ' + deadlineLabel(v)}</Text>
          </View>
          {isNew(v) ? (
            <View style={[styles.deadline, { backgroundColor: VGREEN.dark }]}>
              <Text style={[styles.deadlineText, { color: '#FFFFFF' }]}>New</Text>
            </View>
          ) : null}
          <View style={{ flex: 1 }} />
          <Pressable onPress={onToggleSave} hitSlop={12} style={styles.save}>
            <Animated.View style={{ transform: [{ scale: pop }] }}>
              <SaveGlyph on={saved} />
            </Animated.View>
          </Pressable>
        </View>
        <Text style={styles.ago}>{postedAgo(v.created_at)}</Text>
      </PressableScale>
    </Animated.View>
  );
}

// A bookmark drawn from simple shapes so it can fill in when saved.
function SaveGlyph({ on }: { on: boolean }) {
  return (
    <View style={{ width: 22, height: 26, alignItems: 'center' }}>
      <View style={{ width: 18, height: 22, borderWidth: 2, borderColor: on ? VGREEN.dark : '#9CA3AF', backgroundColor: on ? VGREEN.dark : 'transparent', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
      <View style={{ position: 'absolute', bottom: 2, width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.surface }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: '#E6ECE8', shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  title: { color: VGREEN.ink, fontSize: 18, lineHeight: 24, fontFamily: fonts.bold },
  school: { color: VGREEN.mid, marginTop: 2, fontSize: 14.5, fontFamily: fonts.semibold },
  by: { color: colors.textMuted, marginTop: 1, fontSize: 13, fontFamily: fonts.body },
  cat: { maxWidth: 120, backgroundColor: VGREEN.pill, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill },
  catText: { color: VGREEN.mid, fontSize: 12, fontFamily: fonts.semibold },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: spacing.lg, rowGap: 4, marginTop: spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { color: colors.textMuted, fontSize: 13, fontFamily: fonts.medium, flexShrink: 1 },
  snippet: { color: '#4B5563', marginTop: spacing.md, lineHeight: 20, fontSize: 14, fontFamily: fonts.body },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md },
  deadline: { backgroundColor: VGREEN.pill, paddingHorizontal: 12, height: 30, borderRadius: radius.pill, justifyContent: 'center' },
  deadlineText: { color: VGREEN.mid, fontSize: 12.5, fontFamily: fonts.semibold },
  save: { padding: 4 },
  ago: { color: colors.textMuted, fontSize: 12, marginTop: 4, fontFamily: fonts.body },
});
