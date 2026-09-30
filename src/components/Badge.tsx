import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, text } from '../theme';

type Tone = 'blue' | 'green' | 'orange' | 'red' | 'purple';

const tones: Record<Tone, { bg: string; fg: string }> = {
  blue: { bg: colors.primarySoft, fg: colors.primary },
  green: { bg: colors.successSoft, fg: colors.success },
  orange: { bg: colors.accentSoft, fg: colors.accentDark },
  red: { bg: colors.dangerSoft, fg: colors.danger },
  purple: { bg: colors.purpleSoft, fg: colors.purple },
};

export default function Badge({ label, tone = 'blue' }: { label: string; tone?: Tone }) {
  const t = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[text.caption, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
});
