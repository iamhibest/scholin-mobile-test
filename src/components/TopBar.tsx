import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, shadow, spacing } from '../theme';
import Icon, { IconName } from './Icon';
import BrandEmblem from './BrandEmblem';

type Props = { onMenu?: () => void; right?: React.ReactNode; title?: string };

export function RoundButton({ icon, onPress, badge }: { icon: IconName; onPress?: () => void; badge?: number }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.round, shadow.soft, pressed && { opacity: 0.85 }]} hitSlop={6}>
      <Icon name={icon} size={22} color={colors.primary} />
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function TopBar({ onMenu, right, title }: Props) {
  return (
    <View style={styles.bar}>
      {onMenu ? <RoundButton icon="menu" onPress={onMenu} /> : <View style={styles.spacer} />}
      <View style={styles.brand}>
        <BrandEmblem style={styles.logo} />
        <Text style={styles.name}>{title || 'Scholin'}</Text>
      </View>
      <View style={styles.right}>{right || <View style={styles.spacer} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 30, height: 31 },
  name: { fontFamily: fonts.headingBold, fontSize: 20, color: colors.primary },
  right: { minWidth: 44, alignItems: 'flex-end' },
  spacer: { width: 44, height: 44 },
  round: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontFamily: fonts.bold },
});
