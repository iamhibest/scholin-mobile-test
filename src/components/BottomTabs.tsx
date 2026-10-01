import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, text } from '../theme';
import Icon, { IconName } from './Icon';

export type TabItem = { key: string; label: string; icon: IconName };

type Props = { tabs: TabItem[]; active: string; onChange: (key: string) => void };

export default function BottomTabs({ tabs, active, onChange }: Props) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.wrap}>
      <View style={styles.row}>
        {tabs.map(t => {
          const on = t.key === active;
          return (
            <Pressable key={t.key} onPress={() => onChange(t.key)} style={styles.item}>
              <View style={[styles.pill, on && { backgroundColor: colors.primarySoft }]}>
                <Icon name={t.icon} size={22} color={on ? colors.primary : colors.textMuted} strokeWidth={on ? 2.2 : 1.8} />
              </View>
              <Text style={[text.caption, { color: on ? colors.primary : colors.textMuted }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, shadowColor: '#101828', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: -4 }, elevation: 12 },
  row: { flexDirection: 'row', paddingTop: 8, paddingBottom: 6, paddingHorizontal: 8 },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  pill: { width: 56, height: 32, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
