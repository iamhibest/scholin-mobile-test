import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, fonts, radius, shadow, spacing, text } from '../theme';
import Icon, { IconName } from './Icon';

type Props = { tag: string; title: string; body?: string; icon: IconName; tone?: 'blue' | 'orange'; onPress?: () => void };

export default function SquareBanner({ tag, title, body, icon, tone = 'blue', onPress }: Props) {
  const { width } = useWindowDimensions();
  const size = (width - spacing.xl * 2 - spacing.md) / 2;
  const blue = tone === 'blue';
  const bg = blue ? colors.primarySoft : colors.accentSoft;
  const fg = blue ? colors.primary : colors.accentDark;
  const chip = blue ? colors.primary : colors.accent;
  const lines = size < 145 ? 2 : 3;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.box, shadow.soft, { width: size, height: size, backgroundColor: bg }, pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] }]}>
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: chip }]}>
          <Icon name={icon} size={20} color="#FFFFFF" />
        </View>
        <View style={styles.arrow}>
          <Icon name="arrowRight" size={16} color={fg} />
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.tag, { color: fg }]}>{tag.toUpperCase()}</Text>
        <Text style={styles.title} numberOfLines={lines}>
          {title}
          {body ? <Text style={styles.body}>{' ' + body}</Text> : null}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.xl, padding: 14, justifyContent: 'space-between', overflow: 'hidden' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center' },
  copy: { gap: 2 },
  tag: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.8 },
  title: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: colors.text },
  body: { fontFamily: fonts.body, color: colors.textMuted },
});
