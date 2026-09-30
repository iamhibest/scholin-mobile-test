import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text } from '../theme';

type Props = { title: string; subtitle?: string; right?: React.ReactNode };

export default function ScreenHeader({ title, subtitle, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <Text style={[text.h1, { color: colors.primary }]}>{title}</Text>
        {subtitle ? <Text style={[text.body, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  flex: { flex: 1 },
});
