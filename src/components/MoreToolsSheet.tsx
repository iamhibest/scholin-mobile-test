import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow, spacing, text } from '../theme';
import Icon, { IconName } from './Icon';
import { toneColors } from './QuickTile';

type Tool = { label: string; icon: IconName; tone: keyof typeof toneColors };
type Section = { title: string; tools: Tool[] };

const sections: Section[] = [
  {
    title: 'Academics',
    tools: [
      { label: 'Students', icon: 'users', tone: 'green' },
      { label: 'Subjects', icon: 'book', tone: 'blue' },
      { label: 'Class Subjects', icon: 'layers', tone: 'purple' },
      { label: 'Student Promotion', icon: 'trend', tone: 'teal' },
      { label: 'Student Migration', icon: 'userPlus', tone: 'pink' },
      { label: 'Report Card Templates', icon: 'file', tone: 'gold' },
    ],
  },
  {
    title: 'Attendance',
    tools: [
      { label: 'Staff Attendance', icon: 'clock', tone: 'amber' },
      { label: 'Student Attendance', icon: 'clipboard', tone: 'green' },
      { label: 'Teacher Attendance', icon: 'checklist', tone: 'blue' },
      { label: 'Attendance QR Codes', icon: 'qr', tone: 'purple' },
    ],
  },
  {
    title: 'School records',
    tools: [
      { label: 'Events and Fees', icon: 'receipt', tone: 'rose' },
      { label: 'Sessions and Terms', icon: 'calendar', tone: 'teal' },
      { label: 'Auto Comments', icon: 'tags', tone: 'pink' },
      { label: 'Archived Sessions', icon: 'layers', tone: 'gold' },
      { label: 'School Settings', icon: 'settings', tone: 'blue' },
    ],
  },
];

type Props = { visible: boolean; onClose: () => void; onSelect: (label: string) => void };

export default function MoreToolsSheet({ visible, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const slide = useRef(new Animated.Value(0)).current;
  const gap = spacing.md;
  const tile = (width - spacing.xl * 2 - gap * 2) / 3;
  const total = sections.reduce((n, s) => n + s.tools.length, 0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(slide, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    } else {
      Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMounted(false));
    }
  }, [visible, slide]);

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: slide }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.sheet,
          { maxHeight: height * 0.86, paddingBottom: Math.max(insets.bottom, 24) },
          { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] },
        ]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Icon name="grid" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>More admin tools</Text>
            <Text style={[text.small, { color: colors.textMuted }]}>{total + ' tools to run your school'}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
            <Icon name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {sections.map(sec => (
            <View key={sec.title} style={{ marginBottom: spacing.lg }}>
              <Text style={styles.section}>{sec.title.toUpperCase()}</Text>
              <View style={[styles.grid, { gap }]}>
                {sec.tools.map(t => {
                  const c = toneColors[t.tone];
                  return (
                    <Pressable
                      key={t.label}
                      onPress={() => onSelect(t.label)}
                      style={({ pressed }) => [styles.tile, shadow.soft, { width: tile, height: tile }, pressed && { opacity: 0.9, transform: [{ scale: 0.96 }] }]}>
                      <View style={[styles.chip, { backgroundColor: c.bg }]}>
                        <Icon name={t.icon} size={22} color={c.fg} />
                      </View>
                      <Text style={styles.label} numberOfLines={3}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: spacing.md },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  headerIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.headingBold, fontSize: 20, lineHeight: 26, color: colors.text },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: spacing.lg },
  section: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1, color: colors.textMuted, marginBottom: spacing.sm, marginLeft: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.sm, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  chip: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.medium, fontSize: 11.5, lineHeight: 15, color: colors.text, textAlign: 'center' },
});
