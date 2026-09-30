import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import Icon, { IconName } from './Icon';

type Props = TextInputProps & {
  label: string;
  error?: string;
  icon?: IconName;
  secure?: boolean;
};

export default function Input({ label, error, icon, secure, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!secure);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.wrap}>
      <Text style={[text.caption, styles.label]}>{label}</Text>
      <View style={[styles.field, { borderColor, borderWidth: focused ? 1.5 : 1 }]}>
        {icon ? <Icon name={icon} size={20} color={colors.textMuted} /> : null}
        <TextInput
          {...rest}
          style={[styles.input, style]}
          secureTextEntry={hidden}
          placeholderTextColor="#9CA3AF"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secure ? (
          <Pressable onPress={() => setHidden(h => !h)} hitSlop={10}>
            <Icon name={hidden ? 'eye' : 'eyeOff'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[text.small, styles.error]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { color: colors.textMuted, marginBottom: 6, letterSpacing: 0.3 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 54,
  },
  input: { flex: 1, ...text.body, color: colors.text, paddingVertical: 0 },
  error: { color: colors.danger, marginTop: 6 },
});
