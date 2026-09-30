import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, text } from '../theme';
import Button from './Button';
import Icon, { IconName } from './Icon';

type Props = { title: string; message?: string; icon?: IconName; actionLabel?: string; onAction?: () => void };

export default function EmptyState({ title, message, icon = 'inbox', actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.circle}>
        <Icon name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={[text.h3, styles.title]}>{title}</Text>
      {message ? <Text style={[text.body, styles.message]}>{message}</Text> : null}
      {actionLabel ? <Button title={actionLabel} onPress={onAction} variant="soft" style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', padding: spacing.xxl },
  circle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, marginTop: spacing.lg, textAlign: 'center' },
  message: { color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  action: { marginTop: spacing.lg, alignSelf: 'stretch' },
});
