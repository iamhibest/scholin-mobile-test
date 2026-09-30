import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

type Props = { width?: number | string; height?: number; radius?: number; style?: ViewStyle };

export default function Skeleton({ width = '100%', height = 16, radius = 8, style }: Props) {
  const pulse = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius: radius, backgroundColor: '#E5E7EB', opacity: pulse }, style]}
    />
  );
}
