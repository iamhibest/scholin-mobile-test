import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';

// Placeholder card with a travelling shimmer while jobs load.
export default function JobSkeleton() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  const x = pulse.interpolate({ inputRange: [0, 1], outputRange: [-320, 320] });

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.logo} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={[styles.bar, { width: '78%' }]} />
          <View style={[styles.bar, { width: '44%', height: 10 }]} />
        </View>
      </View>
      <View style={[styles.bar, { width: '100%', marginTop: spacing.lg }]} />
      <View style={[styles.bar, { width: '86%', marginTop: 8 }]} />
      <View style={[styles.bar, { width: '36%', height: 10, marginTop: spacing.lg }]} />
      <Animated.View pointerEvents="none" style={[styles.sheen, { transform: [{ translateX: x }, { skewX: '-18deg' }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: '#EEF1F6' },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  logo: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#EDF0F5' },
  bar: { height: 14, borderRadius: 7, backgroundColor: '#EDF0F5' },
  sheen: { position: 'absolute', top: 0, bottom: 0, width: 90, backgroundColor: 'rgba(255,255,255,0.7)' },
});
