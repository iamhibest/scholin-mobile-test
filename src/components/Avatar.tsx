import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

type Props = { name?: string; uri?: string; size?: number };

export default function Avatar({ name = '', uri, size = 48 }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const initials = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri && !failed) {
    return <Image key={uri} source={{ uri }} style={[box, { backgroundColor: colors.primarySoft }]} resizeMode="cover" onError={() => setFailed(true)} />;
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
