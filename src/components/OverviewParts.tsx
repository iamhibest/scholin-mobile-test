import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, radius, spacing, text } from '../theme';

export const AMBER = colors.accentDark;
export const RED = colors.danger;
export const GREEN = colors.success;

export function tierColor(rate: number) {
  return rate >= 90 ? GREEN : rate >= 75 ? AMBER : RED;
}

export function SectionCard({ title, hint, children, right }: { title: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={[text.h3, { color: colors.text }]}>{title}</Text>
          {hint ? <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>{hint}</Text> : null}
        </View>
        {right}
      </View>
      <View style={{ marginTop: spacing.md }}>{children}</View>
    </View>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={[text.small, { color: colors.textMuted }]}>{children}</Text>;
}

export function Ring({ score, color, caption, size = 76, suffix = '%' }: { score: number; color: string; caption?: string; size?: number; suffix?: string }) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(score, 100)) / 100);
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <View style={{ transform: [{ rotate: '-90deg' }] }}>
          <Svg width={size} height={size}>
            <Circle cx={c} cy={c} r={r} stroke="#EEF1F4" strokeWidth={stroke} fill="none" />
            <Circle cx={c} cy={c} r={r} stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={String(circ)} strokeDashoffset={offset} fill="none" />
          </Svg>
        </View>
        <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: size * 0.27, fontWeight: '700', color: colors.text }}>{score + suffix}</Text>
        </View>
      </View>
      {caption ? <Text style={[text.caption, { color: colors.textMuted, marginTop: 4, textAlign: 'center' }]}>{caption}</Text> : null}
    </View>
  );
}

export function RingList({ ring, children }: { ring: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
      {ring}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

export function DotRow({ color, label, value, valueColor }: { color?: string; label: string; value: string | number; valueColor?: string }) {
  return (
    <View style={styles.dotRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
        <Text style={[text.small, { color: colors.text, flexShrink: 1 }]}>{label}</Text>
      </View>
      <Text style={[text.bodyStrong, { color: valueColor || colors.text }]}>{String(value)}</Text>
    </View>
  );
}

export function Pill({ label, color, bg }: { label: string; color: string; bg: string }) {
  return <Text style={[styles.pill, { color, backgroundColor: bg }]}>{label}</Text>;
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.alert}>
      <Text style={[text.small, { color: RED, flex: 1 }]}>{children}</Text>
    </View>
  );
}

export function Highlights({ items }: { items: { label: string; value: string; tone?: 'up' | 'down' }[] }) {
  return (
    <View style={styles.hlGrid}>
      {items.map(i => (
        <View key={i.label} style={styles.hl}>
          <Text style={[text.caption, { color: colors.textMuted }]}>{i.label}</Text>
          <Text style={[text.bodyStrong, { color: i.tone === 'up' ? GREEN : i.tone === 'down' ? RED : colors.text, marginTop: 2 }]}>{i.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function BadgeGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <View style={styles.hlGrid}>
      {items.map(i => (
        <View key={i.label} style={styles.badge}>
          <Text style={[text.caption, { color: colors.textMuted }]} numberOfLines={1}>{i.label}</Text>
          <Text style={[text.bodyStrong, { color: colors.primary }]} numberOfLines={1}>{i.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function BarRow({ label, value, max, color, right }: { label: string; value: number; max: number; color: string; right: string }) {
  return (
    <View style={styles.barRow}>
      <Text style={[text.bodyStrong, { color: colors.primary, width: 26 }]}>{label}</Text>
      <View style={styles.track}>
        <View style={{ width: Math.max(value > 0 ? 3 : 0, (value / Math.max(max, 1)) * 100) + '%', height: '100%', backgroundColor: color, borderRadius: 6 }} />
      </View>
      <Text style={[text.small, { color: colors.textMuted, width: 78, textAlign: 'right' }]}>{right}</Text>
    </View>
  );
}

export function Columns({ bars }: { bars: { label: string; rate: number }[] }) {
  const H = 130;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, flexGrow: 1, minWidth: '100%' }}>
        {bars.map((b, i) => (
          <View key={i} style={{ flex: 1, minWidth: 34, alignItems: 'center' }}>
            <Text style={[text.caption, { color: colors.textMuted, marginBottom: 3 }]}>{b.rate + '%'}</Text>
            <View style={{ height: H, justifyContent: 'flex-end', width: '100%', alignItems: 'center' }}>
              <View style={{ width: '70%', maxWidth: 36, height: Math.max(3, (b.rate / 100) * H), backgroundColor: colors.primary, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
            </View>
            <Text style={[text.caption, { color: colors.textMuted, marginTop: 4 }]} numberOfLines={1}>{b.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function Donut({ segments, size = 110 }: { segments: { label: string; count: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.count, 0);
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let used = 0;
  return (
    <View style={{ transform: [{ rotate: '-90deg' }] }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke="#EEF1F4" strokeWidth={stroke} fill="none" />
        {segments.map(s => {
          const len = total ? (s.count / total) * circ : 0;
          const el = <Circle key={s.label} cx={c} cy={c} r={r} stroke={s.color} strokeWidth={stroke} fill="none" strokeDasharray={len + ' ' + (circ - len)} strokeDashoffset={-used} />;
          used += len;
          return el;
        })}
      </Svg>
    </View>
  );
}

export function ListRow({ name, meta, figure, figureColor }: { name: string; meta?: string; figure?: string; figureColor?: string }) {
  return (
    <View style={styles.listRow}>
      <View style={{ flex: 1 }}>
        <Text style={[text.bodyStrong, { color: colors.text }]}>{name}</Text>
        {meta ? <Text style={[text.caption, { color: colors.textMuted }]}>{meta}</Text> : null}
      </View>
      {figure ? <Text style={[text.bodyStrong, { color: figureColor || RED }]}>{figure}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  dotRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, gap: spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pill: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden', textTransform: 'capitalize' },
  alert: { backgroundColor: colors.dangerSoft, borderRadius: 12, padding: spacing.md, marginTop: spacing.md, flexDirection: 'row' },
  hlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.md },
  hl: { width: '47%', flexGrow: 1 },
  badge: { width: '30%', flexGrow: 1, backgroundColor: colors.background, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: 10 },
  track: { flex: 1, height: 18, backgroundColor: '#EEF1F4', borderRadius: 6, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
});
