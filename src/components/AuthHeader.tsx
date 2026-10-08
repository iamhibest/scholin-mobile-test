import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BrandEmblem from './BrandEmblem';
import { colors, spacing, text } from '../theme';

type Props = { title: string; subtitle?: string };

export default function AuthHeader({ title, subtitle }: Props) {
  return (
    <View style={styles.head}>
      <BrandEmblem style={styles.emblem} />
      <Text style={[text.h1, styles.title]}>{title}</Text>
      {subtitle ? <Text style={[text.body, styles.sub]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.xl },
  emblem: { width: 76, height: 79 },
  title: { color: colors.primary, marginTop: spacing.lg, textAlign: 'center' },
  sub: { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
});
