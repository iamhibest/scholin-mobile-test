import React, { useEffect, useRef } from 'react';
import { Animated, Image, StatusBar, StyleSheet, View } from 'react-native';

const EMBLEM_HEIGHT = 124;
const EMBLEM_WIDTH = Math.round((EMBLEM_HEIGHT * 692) / 720);
const WORD_WIDTH = 190;
const WORD_HEIGHT = Math.round((WORD_WIDTH * 271) / 900);

type Props = { onDone: () => void };

export default function SplashOverlay({ onDone }: Props) {
  const fade = useRef(new Animated.Value(1)).current;
  const word = useRef(new Animated.Value(0)).current;
  const shift = (StatusBar.currentHeight || 0) / 2;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(350),
      Animated.timing(word, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(fade, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start(() => onDone());
  }, [fade, word, onDone]);

  return (
    <Animated.View style={[styles.root, { opacity: fade }]} pointerEvents="auto">
      <View style={{ transform: [{ translateY: -shift }], alignItems: 'center' }}>
        <Image source={require('../assets/images/emblem.png')} style={{ width: EMBLEM_WIDTH, height: EMBLEM_HEIGHT }} resizeMode="contain" />
        <Animated.View style={[styles.word, { opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
          <Image source={require('../assets/images/wordmark.png')} style={{ width: WORD_WIDTH, height: WORD_HEIGHT }} resizeMode="contain" />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  word: { position: 'absolute', top: EMBLEM_HEIGHT + 18 },
});
