import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, spacing, text } from '../theme';
import Icon from './Icon';

type Props = { value: string; onChange: (v: string) => void; placeholder?: string };

export default function SearchBar({ value, onChange, placeholder = 'Search' }: Props) {
  return (
    <View style={styles.box}>
      <Icon name="search" size={19} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        style={styles.input}
        autoCorrect={false}
        returnKeyType="search"
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10}>
          <Icon name="close" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, height: 48 },
  input: { flex: 1, ...text.body, color: colors.text, paddingVertical: 0 },
});
