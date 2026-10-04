import React, { useRef } from 'react';
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native';

type Props = { onPress?: () => void; onLongPress?: () => void; style?: StyleProp<ViewStyle>; children: React.ReactNode; to?: number; disabled?: boolean };

// A pressable that sinks slightly under the finger and springs back.
export default function PressableScale({ onPress, onLongPress, style, children, to = 0.97, disabled }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (value: number) => Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <Pressable disabled={disabled} onPress={onPress} onLongPress={onLongPress} onPressIn={() => animate(to)} onPressOut={() => animate(1)}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
