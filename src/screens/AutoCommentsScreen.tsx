import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, EmptyState, Input, Notice, Screen, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { useChain } from '../lib/useChain';
import { confirmAction } from '../lib/confirm';
import { addBand, deleteBand, fetchBands } from '../lib/admin';

export default function AutoCommentsScreen() {
  const { ctx, loading: ctxLoading } = useStaff();
  const chain = useChain(5);
  const [bands, setBands] = useState<any[] | null>(null);
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [teacher, setTeacher] = useState('');
  const [head, setHead] = useState('');
  const [principal, setPrincipal] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      setBands(await fetchBands(ctx.schoolId));
    } catch (e: any) {
      setBands([]);
      setNotice({ message: e.message, tone: 'error' });
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const add = async () => {
    if (!ctx) {
      return;
    }
    const lo = parseFloat(min);
    const hi = parseFloat(max);
    if (isNaN(lo) || isNaN(hi)) {
      setNotice({ message: 'Please enter both min and max scores.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await addBand(ctx.schoolId, { min: lo, max: hi, teacher, head, principal });
      setMin('');
      setMax('');
      setTeacher('');
      setHead('');
      setPrincipal('');
      setNotice({ message: 'Band added.', tone: 'success' });
      await load();
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy(false);
  };

  const remove = (id: string) => {
    confirmAction('Remove band', 'Remove this score band?', 'Remove', async () => {
      try {
        await deleteBand(id);
        await load();
      } catch (e: any) {
        setNotice({ message: e.message, tone: 'error' });
      }
    });
  };

  if (ctxLoading || !bands) {
    return (
      <Screen>
        <Skeleton height={240} radius={20} />
      </Screen>
    );
  }

  if (ctx && !ctx.isAdmin) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Admins only" message="Only the school owner and teacher admins can manage auto comments." />
      </Screen>
    );
  }

  const area = (label: string, value: string, set: (v: string) => void) => (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[text.caption, { color: colors.textMuted, marginBottom: 6 }]}>{label}</Text>
      <TextInput value={value} onChangeText={set} multiline textAlignVertical="top" style={styles.area} placeholderTextColor="#9CA3AF" />
    </View>
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={bands}
        keyExtractor={b => b.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={
          <View>
            <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>Set the comments the Apply suggested comments button uses, based on a student's average score.</Text>
            <Card style={{ marginBottom: spacing.xl }}>
              <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>New score band</Text>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Input {...chain(0)} label="Min score %" value={min} onChangeText={setMin} keyboardType="decimal-pad" placeholder="0" />
                </View>
                <View style={{ flex: 1 }}>
                  <Input {...chain(1)} label="Max score %" value={max} onChangeText={setMax} keyboardType="decimal-pad" placeholder="39" />
                </View>
              </View>
              {area("Class teacher's comment", teacher, setTeacher)}
              {area("Head teacher's comment", head, setHead)}
              {area("Principal's comment", principal, setPrincipal)}
              <Button title="Add band" icon="plus" loading={busy} onPress={add} />
            </Card>
            <Notice message={notice.message} tone={notice.tone} />
          </View>
        }
        ListEmptyComponent={<EmptyState icon="chat" title="No score bands set up yet" message="Add your first band above, for example 0 to 39 percent." />}
        renderItem={({ item }) => (
          <Card>
            <Text style={[text.h3, { color: colors.primary }]}>{'Score: ' + item.min_score + '% to ' + item.max_score + '%'}</Text>
            <Text style={[text.small, styles.line]}><Text style={styles.strong}>Class teacher: </Text>{item.class_teacher_text || 'None'}</Text>
            <Text style={[text.small, styles.line]}><Text style={styles.strong}>Head teacher: </Text>{item.head_teacher_text || 'None'}</Text>
            <Text style={[text.small, styles.line]}><Text style={styles.strong}>Principal: </Text>{item.principal_text || 'None'}</Text>
            <Button title="Remove band" variant="danger" onPress={() => remove(item.id)} style={{ marginTop: spacing.md, height: 44 }} />
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  area: { minHeight: 80, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  line: { color: colors.textMuted, marginTop: spacing.sm },
  strong: { fontFamily: fonts.semibold, color: colors.text },
});
