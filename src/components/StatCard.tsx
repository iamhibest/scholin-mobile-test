import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts, radius, shadow, spacing, text } from '../theme';
import Icon, { IconName } from './Icon';

type Tone = 'amber' | 'green' | 'purple' | 'blue';

const tones: Record<Tone, { bg: string; chip: string; fg: string }> = {
  amber: { bg: '#FDF1E4', chip: colors.accent, fg: colors.accentDark },
  green: { bg: '#E8F4EA', chip: colors.success, fg: colors.success },
  purple: { bg: '#EFEDFC', chip: colors.purple, fg: colors.purple },
  blue: { bg: colors.primarySoft, chip: colors.primary, fg: colors.primary },
};

type Props = {
  label: string;
  value: string;
  sub?: string;
  icon: IconName;
  tone: Tone;
  size?: 'hero' | 'mini';
  trend?: number | null;
  valueColor?: string;
  subColor?: string;
  cta?: string;
  onPress?: () => void;
  style?: ViewStyle;
};

export default function StatCard({ label, value, sub, icon, tone, size = 'mini', trend, valueColor, subColor, cta, onPress, style }: Props) {
  const t = tones[tone];
  const hero = size === 'hero';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, shadow.soft, { backgroundColor: t.bg }, hero && styles.hero, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }, style]}>
      <View style={styles.top}>
        <View style={[styles.chip, { backgroundColor: t.chip }, hero && styles.chipHero]}>
          <Icon name={icon} size={hero ? 24 : 18} color="#FFFFFF" />
        </View>
        {!hero && onPress ? <Icon name="chevron" size={18} color={colors.textMuted} /> : null}
      </View>
      <Text style={[text.bodyStrong, { color: colors.text, marginTop: hero ? spacing.lg : spacing.md }]}>{label}</Text>
      <Text style={[hero ? styles.valueHero : styles.value, { color: valueColor || colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <View style={styles.subRow}>
        {sub ? <Text style={[text.small, { color: subColor || colors.textMuted, flexShrink: 1 }]}>{sub}</Text> : null}
        {trend !== null && trend !== undefined ? (
          <View style={styles.trend}>
            <Icon name={trend >= 0 ? 'up' : 'down'} size={12} color={trend >= 0 ? colors.success : colors.danger} strokeWidth={2.6} />
            <Text style={[text.caption, { color: trend >= 0 ? colors.success : colors.danger }]}>{Math.abs(trend)}%</Text>
          </View>
        ) : null}
      </View>
      {cta ? (
        <View style={[styles.cta, { backgroundColor: 'rgba(255,255,255,0.75)' }]}>
          <Text style={[text.bodyStrong, { color: t.fg }]}>{cta}</Text>
          <Icon name="arrowRight" size={16} color={t.fg} />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing.lg },
  hero: { padding: spacing.xl },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  chip: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chipHero: { width: 52, height: 52, borderRadius: 16 },
  value: { fontFamily: fonts.headingBold, fontSize: 26, lineHeight: 34, marginTop: 2 },
  valueHero: { fontFamily: fonts.headingBold, fontSize: 28, lineHeight: 38, marginTop: 4 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', marginTop: spacing.lg, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill },
});
