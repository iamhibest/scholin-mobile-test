import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, text } from '../theme';
import Icon from './Icon';
import { onForegroundNotification, openFromNotification } from '../lib/push';

// Android does not show a notification while the app is open, so this slides one in from the top instead.
export default function PushBanner() {
  const insets = useSafeAreaInsets();
  const [item, setItem] = useState<{ title: string; body: string; data: Record<string, any> } | null>(null);
  const y = useRef(new Animated.Value(-160)).current;
  const timer = useRef<any>(null);

  const hide = () => {
    Animated.timing(y, { toValue: -160, duration: 200, useNativeDriver: true }).start(() => setItem(null));
  };

  useEffect(() => {
    const off = onForegroundNotification(m => {
      setItem(m);
      y.setValue(-160);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      clearTimeout(timer.current);
      timer.current = setTimeout(hide, 5500);
    });
    return () => {
      off();
      clearTimeout(timer.current);
    };
  }, []);

  if (!item) {
    return null;
  }
  return (
    <Animated.View pointerEvents="box-none" style={[styles.wrap, { top: insets.top + 8, transform: [{ translateY: y }] }]}>
      <Pressable
        onPress={() => {
          const data = item.data;
          hide();
          openFromNotification(data);
        }}
        style={styles.card}>
        <View style={styles.icon}>
          <Icon name="bell" size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
          {item.body ? <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={2}>{item.body}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, zIndex: 999, elevation: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 12 },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
