import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, Icon, Notice, Screen, Skeleton } from '../components';
import { colors, fonts, radius, shadow, spacing, text } from '../theme';
import { fetchArrangeList, saveArrangement } from '../lib/portal';

export default function ArrangeSubjectsScreen({ navigation, route }: any) {
  const { classId } = route.params;
  const insets = useSafeAreaInsets();
  const [list, setList] = useState<{ id: string; name: string }[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  useEffect(() => {
    navigation.setOptions({ title: 'Arrange Subjects' });
    fetchArrangeList(classId).then(setList).catch(e => {
      setList([]);
      setNotice({ message: e.message, tone: 'error' });
    });
  }, [classId, navigation]);

  const move = (index: number, dir: -1 | 1) => {
    if (!list) {
      return;
    }
    const target = index + dir;
    if (target < 0 || target >= list.length) {
      return;
    }
    const next = list.slice();
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    setList(next);
    setNotice({ message: '', tone: 'success' });
  };

  const save = async () => {
    if (!list) {
      return;
    }
    setSaving(true);
    try {
      await saveArrangement(list);
      setNotice({ message: "Arrangement saved. This class's report cards will now use this order.", tone: 'success' });
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setSaving(false);
  };

  if (!list) {
    return (
      <Screen>
        <Skeleton height={220} radius={20} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 110 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>Use the arrows to set the order subjects appear in on this class's report card.</Text>
        <Notice message={notice.message} tone={notice.tone} />
        {list.length === 0 ? (
          <EmptyState icon="book" title="No subjects assigned" message="Assign subjects to this class first in Class Subjects." />
        ) : (
          list.map((s, i) => (
            <View key={s.id} style={styles.row}>
              <View style={styles.num}>
                <Text style={[text.caption, { color: colors.primary }]}>{i + 1}</Text>
              </View>
              <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={1}>{s.name}</Text>
              <Pressable onPress={() => move(i, -1)} disabled={i === 0} style={[styles.arrow, i === 0 && { opacity: 0.3 }]} hitSlop={6}>
                <View style={{ transform: [{ rotate: '180deg' }] }}>
                  <Icon name="chevronDown" size={20} color={colors.primary} />
                </View>
              </Pressable>
              <Pressable onPress={() => move(i, 1)} disabled={i === list.length - 1} style={[styles.arrow, i === list.length - 1 && { opacity: 0.3 }]} hitSlop={6}>
                <Icon name="chevronDown" size={20} color={colors.primary} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
      {list.length > 0 ? (
        <View style={[styles.bar, shadow.raised, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
          <Button title="Save arrangement" loading={saving} onPress={save} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  num: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, paddingHorizontal: spacing.xl, paddingTop: spacing.md, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
});
