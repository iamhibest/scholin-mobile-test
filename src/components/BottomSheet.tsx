import React, { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, text } from '../theme';

type Props = { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode };

export default function BottomSheet({ visible, onClose, title, children }: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [keyboard, setKeyboard] = useState(0);
  const [contentH, setContentH] = useState(0);
  const [boxH, setBoxH] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', e => setKeyboard(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const bottomPad = keyboard > 0 ? spacing.lg : Math.max(insets.bottom, 24) + spacing.lg;
  const maxHeight = height - keyboard - insets.top - 24;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.wrap, { bottom: keyboard }]} pointerEvents="box-none">
        <View style={[styles.sheet, { maxHeight, paddingBottom: bottomPad }]}>
          <View style={styles.handle} />
          {title ? <Text style={[text.h2, styles.title]}>{title}</Text> : null}
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
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  wrap: { position: 'absolute', left: 0, right: 0 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.lg },
  title: { color: colors.text, marginBottom: spacing.lg },
});
