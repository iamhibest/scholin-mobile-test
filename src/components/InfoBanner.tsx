import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, shadow, spacing, text } from '../theme';
import Icon, { IconName } from './Icon';

type Props = { tag: string; title: string; body?: string; icon: IconName; tone?: 'blue' | 'orange'; action?: string; onPress?: () => void };

export default function InfoBanner({ tag, title, body, icon, tone = 'blue', action = 'View', onPress }: Props) {
  const blue = tone === 'blue';
  const bg = blue ? colors.primarySoft : colors.accentSoft;
  const fg = blue ? colors.primary : colors.accentDark;
  const chip = blue ? colors.primary : colors.accent;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.box, shadow.soft, { backgroundColor: bg }, pressed && { opacity: 0.92 }]}>
      <View style={[styles.icon, { backgroundColor: chip }]}>
        <Icon name={icon} size={22} color="#FFFFFF" />
      </View>
      <View style={styles.body}>
        <View style={[styles.tag, { backgroundColor: 'rgba(255,255,255,0.8)' }]}>
          <Text style={[text.caption, { color: fg, letterSpacing: 0.6 }]}>{tag.toUpperCase()}</Text>
        </View>
        <Text style={[text.bodyStrong, { color: colors.text, marginTop: 4 }]} numberOfLines={2}>
          {title}
          {body ? <Text style={[text.body, { color: colors.text }]}>{'  ' + body}</Text> : null}
        </Text>
      </View>
      <View style={styles.action}>
        <Text style={[text.caption, { color: fg }]}>{action}</Text>
        <Icon name="chevron" size={14} color={fg} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.lg },
  icon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  action: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.85)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
});
