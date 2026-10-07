import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, Modal, PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, text } from '../theme';

type Props = { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode };

// Closes when you tap outside it, swipe it down, press the back button, or tap a close action inside.
export default function BottomSheet({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [keyboard, setKeyboard] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [boxH, setBoxH] = useState(0);
  const [mounted, setMounted] = useState(visible);
  const slide = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', e => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.setValue(0);
      Animated.timing(slide, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else {
      Animated.timing(slide, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) {
          setMounted(false);
        }
      });
    }
  }, [visible, slide, drag]);

  // Dragging the handle or title area down closes the sheet. A short drag springs back.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) {
          drag.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 80 || g.vy > 0.7) {
          closeRef.current();
        } else {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    }),
  ).current;

  const bottomPad = keyboard > 0 ? spacing.lg : Math.max(insets.bottom, 24) + spacing.lg;
  const maxHeight = height - keyboard - insets.top - 24;
  const translateY = Animated.add(slide.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }), drag);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: slide }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.sheet, { maxHeight, bottom: keyboard, paddingBottom: bottomPad, transform: [{ translateY }] }]}>
          <View {...pan.panHandlers} style={styles.grab}>
            <View style={styles.handle} />
            {title ? <Text style={[text.h2, styles.title]} numberOfLines={3}>{title}</Text> : null}
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
            nestedScrollEnabled
            scrollEnabled={contentH > boxH + 2}
            onLayout={e => setBoxH(e.nativeEvent.layout.height)}
            onContentSizeChange={(_w, h) => setContentH(h)}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
  },
  grab: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: spacing.md },
  title: { color: colors.text, marginTop: spacing.xs },
});
