import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import ScrollView from './KeyboardAwareScrollView';
import KeyboardSafeView from './KeyboardSafeView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  background?: string;
};

export default function Screen({ children, scroll, padded = true, style, background }: Props) {
  const inner = padded ? styles.padded : undefined;
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: background || colors.background }]}>
      <KeyboardSafeView>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, style]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner, style]}>{children}</View>
      )}
      </KeyboardSafeView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
});
