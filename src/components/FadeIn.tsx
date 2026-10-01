import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';

type Props = { children: React.ReactNode; delay?: number; style?: ViewStyle };

export default function FadeIn({ children, delay = 0, style }: Props) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 420, delay, useNativeDriver: true }).start();
  }, [v, delay]);

  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}
