import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from './Icon';
import { text } from '../theme';

type Item = { id?: string; title: string; poster?: string };

// Each slide gets its own colour. Slides only move sideways (no opacity, no shadow),
// so there is no grey flash or flicker on Android.
const PALETTE = [
  { bg: '#FFF1E3', fg: '#B54708', icon: '#F28C28' },
  { bg: '#E6EEFF', fg: '#1A47B8', icon: '#2F6BFF' },
  { bg: '#E3F5EA', fg: '#146C43', icon: '#22A06B' },
  { bg: '#EEE8FF', fg: '#4F36B8', icon: '#7B5CF0' },
  { bg: '#FFE8EE', fg: '#B4233F', icon: '#E5456B' },
];

const HEIGHT = 92;
const SLIDE_MS = 520;

function Slide({ item, index, width, onPress }: { item: Item; index: number; width: number; onPress: () => void }) {
  const c = PALETTE[index % PALETTE.length];
  return (
    <Pressable onPress={onPress} style={[styles.slide, { width, backgroundColor: c.bg }]}>
      <View style={[styles.iconBox, { backgroundColor: c.icon }]}>
        <Icon name="briefcase" size={22} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={[styles.tag, { backgroundColor: 'rgba(255,255,255,0.75)' }]}>
          <Text style={[styles.tagText, { color: c.fg }]}>VACANCIES</Text>
        </View>
        <Text style={[text.bodyStrong, { color: '#111827', marginTop: 4 }]} numberOfLines={2}>
          {item.title ? item.title + '.' : ''}
        </Text>
        {item.poster ? (
          <Text style={[text.small, { color: '#4B5563' }]} numberOfLines={1}>
            {'Posted by ' + item.poster}
          </Text>
        ) : null}
      </View>
      <View style={styles.view}>
        <Text style={[styles.viewText, { color: c.fg }]}>View ›</Text>
      </View>
    </Pressable>
  );
}

export default function VacancyBanner({ items, seconds, onPress }: { items: Item[]; seconds: number; onPress: () => void }) {
  const [width, setWidth] = useState(0);
  const [cur, setCur] = useState(0);
  const p = useRef(new Animated.Value(0)).current;
  const n = items.length;
  const safe = n ? cur % n : 0;
  const next = n ? (safe + 1) % n : 0;

  useEffect(() => {
    if (n < 2 || !width) {
      return;
    }
    const wait = Math.max(3, seconds || 5) * 1000;
    const timer = setTimeout(() => {
      Animated.timing(p, { toValue: 1, duration: SLIDE_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) {
          setCur(c => (c + 1) % n);
          p.setValue(0);
        }
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [safe, n, width, seconds, p]);

  if (!n) {
    return null;
  }

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w !== width) {
      setWidth(w);
    }
  };

  const outX = p.interpolate({ inputRange: [0, 1], outputRange: [0, -width] });
  const inX = p.interpolate({ inputRange: [0, 1], outputRange: [width, 0] });

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      {width ? (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: outX }] }]}>
            <Slide item={items[safe]} index={safe} width={width} onPress={onPress} />
          </Animated.View>
          {n > 1 ? (
            <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX: inX }] }]}>
              <Slide item={items[next]} index={next} width={width} onPress={onPress} />
            </Animated.View>
          ) : null}
        </>
      ) : null}
      {n > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {items.map((_, i) => (
            <View key={i} style={[styles.dot, i === safe && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: HEIGHT, borderRadius: 22, overflow: 'hidden', marginTop: 16, marginBottom: 16 },
  slide: { height: HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 6 },
  iconBox: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tag: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  tagText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  view: { backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  viewText: { fontSize: 12, fontWeight: '700' },
  dots: { position: 'absolute', right: 16, bottom: 7, flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(17,24,39,0.18)' },
  dotOn: { width: 14, backgroundColor: 'rgba(17,24,39,0.5)' },
});
