import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing, text } from '../theme';
import Icon, { IconName } from './Icon';

export type MenuItem = { label: string; icon: IconName; onPress: () => void; hidden?: boolean; active?: boolean };
export type MenuGroup = { title?: string; items: MenuItem[] };

type Props = {
  visible: boolean;
  onClose: () => void;
  groups: MenuGroup[];
  header?: React.ReactNode;
  footer: MenuItem;
};

const WIDTH = Math.min(Dimensions.get('window').width * 0.84, 340);

export default function SideMenu({ visible, onClose, groups, header, footer }: Props) {
  const x = useRef(new Animated.Value(-WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(x, { toValue: 0, duration: 260, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(x, { toValue: -WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
  }, [visible, x, fade]);

  function choose(item: MenuItem) {
    onClose();
    setTimeout(item.onPress, 240);
  }

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: fade }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View style={[styles.panel, { transform: [{ translateX: x }] }]}>
          <View style={styles.brand}>
            <Image source={require('../assets/images/emblem.png')} style={styles.logo} resizeMode="contain" />
            <View>
              <Text style={styles.name}>Scholin</Text>
              <Text style={[text.caption, { color: colors.textMuted }]}>Smarter Schools. Brighter Futures.</Text>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing.lg }}>
            {header}
            {groups.map((g, gi) => {
              const items = g.items.filter(i => !i.hidden);
              if (items.length === 0) {
                return null;
              }
              return (
                <View key={gi} style={{ marginTop: spacing.lg }}>
                  {g.title ? <Text style={[text.caption, styles.group]}>{g.title.toUpperCase()}</Text> : null}
                  {items.map(item => (
                    <Pressable key={item.label} onPress={() => choose(item)} style={({ pressed }) => [styles.item, item.active && styles.itemActive, pressed && { backgroundColor: colors.background }]}>
                      <Icon name={item.icon} size={20} color={item.active ? colors.primary : colors.textMuted} />
                      <Text style={[text.bodyStrong, { color: item.active ? colors.primary : colors.text }]}>{item.label}</Text>
                    </Pressable>
                  ))}
                </View>
              );
            })}
          </ScrollView>
          <Pressable onPress={() => choose(footer)} style={styles.footer}>
            <Icon name={footer.icon} size={20} color={colors.danger} />
            <Text style={[text.bodyStrong, { color: colors.danger }]}>{footer.label}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, width: WIDTH, backgroundColor: colors.surface, paddingTop: 44, paddingHorizontal: spacing.lg, borderTopRightRadius: radius.xl, borderBottomRightRadius: radius.xl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  logo: { width: 42, height: 44 },
  name: { fontFamily: fonts.headingBold, fontSize: 22, color: colors.primary },
  group: { color: colors.textMuted, letterSpacing: 1, marginBottom: 4, marginLeft: spacing.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13, paddingHorizontal: spacing.md, borderRadius: radius.md },
  itemActive: { backgroundColor: colors.primarySoft },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginBottom: spacing.md },
});
