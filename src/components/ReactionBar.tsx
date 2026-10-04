import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Heart, Sparkles, ThumbsUp } from 'lucide-react-native';
import { colors, fonts, radius } from '../theme';
import { Reaction, REACTIONS } from '../lib/announcements';

const GLYPH: Record<Reaction, any> = { like: ThumbsUp, love: Heart, clap: Sparkles };
const TINT: Record<Reaction, string> = { like: '#1A56DB', love: '#E11D48', clap: '#D97706' };

function Chip({ kind, label, count, active, onPress }: { kind: Reaction; label: string; count: number; active: boolean; onPress: () => void }) {
  const pop = useRef(new Animated.Value(1)).current;
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (active) {
      Animated.sequence([
        Animated.spring(pop, { toValue: 1.5, useNativeDriver: true, speed: 60, bounciness: 14 }),
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
      ]).start();
    }
  }, [active, pop]);
  const Glyph = GLYPH[kind];
  const tint = active ? TINT[kind] : colors.textMuted;
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: tint + '1A', borderColor: tint + '55' }]}>
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Glyph size={16} color={tint} strokeWidth={2} fill={active && kind === 'love' ? tint : 'none'} />
      </Animated.View>
      <Text style={[styles.label, { color: tint }]}>{label + (count > 0 ? ' ' + count : '')}</Text>
    </Pressable>
  );
}

type Props = { counts: Record<string, number>; mine: string[]; onToggle: (r: Reaction) => void };

export default function ReactionBar({ counts, mine, onToggle }: Props) {
  return (
    <View style={styles.row}>
      {REACTIONS.map(r => (
        <Chip key={r.key} kind={r.key} label={r.label} count={counts[r.key] || 0} active={mine.includes(r.key)} onPress={() => onToggle(r.key)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: '#F4F6FA', borderWidth: 1, borderColor: 'transparent' },
  label: { fontSize: 12.5, fontFamily: fonts.semibold },
});
