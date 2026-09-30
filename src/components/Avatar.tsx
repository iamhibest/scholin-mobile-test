import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = { name?: string; uri?: string; size?: number };

export default function Avatar({ name = '', uri, size = 48 }: Props) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return <Image source={{ uri }} style={box} />;
  }
  return (
    <View style={[styles.fallback, box]}>
      <Text style={{ fontFamily: fonts.semibold, color: colors.primary, fontSize: size * 0.36 }}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
