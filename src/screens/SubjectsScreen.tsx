import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, EmptyState, Icon, Input, Notice, Screen, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { confirmAction } from '../lib/confirm';
import { addSubject, deleteSubject, fetchSubjects, renameSubject } from '../lib/admin';
import { Pressable } from 'react-native';

export default function SubjectsScreen() {
  const { ctx, loading: ctxLoading } = useStaff();
  const [list, setList] = useState<any[] | null>(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState('');
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      setList(await fetchSubjects(ctx.schoolId));
    } catch (e: any) {
      setList([]);
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
    if (!name.trim()) {
      setNotice({ message: 'Please enter a subject name.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await addSubject(ctx.schoolId, name.trim());
      setName('');
      setNotice({ message: '', tone: 'success' });
      await load();
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy(false);
  };

  const saveEdit = async (id: string) => {
    if (!editName.trim()) {
      setNotice({ message: 'Subject name cannot be empty.', tone: 'error' });
      return;
    }
    try {
      await renameSubject(id, editName.trim());
      setEditing('');
      await load();
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
  };

  const remove = (s: any) => {
    confirmAction('Remove subject', 'Remove "' + s.name + '"? This also deletes any results recorded under this subject. This cannot be undone.', 'Remove', async () => {
      try {
        await deleteSubject(s.id);
        await load();
      } catch (e: any) {
        setNotice({ message: e.message, tone: 'error' });
      }
    });
  };

  if (ctxLoading || !list) {
    return (
      <Screen>
        <Skeleton height={200} radius={20} />
      </Screen>
    );
  }

  if (ctx && !ctx.isAdmin) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Admins only" message="Only the school owner and teacher admins can manage subjects." />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={list}
        keyExtractor={s => s.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={
          <View>
            <Card style={{ marginBottom: spacing.lg }}>
              <Input label="New subject" value={name} onChangeText={setName} placeholder="e.g. Mathematics" icon="book" autoCapitalize="words" returnKeyType="done" onSubmitEditing={add} />
              <Button title="Add subject" icon="plus" loading={busy} onPress={add} />
            </Card>
            <Notice message={notice.message} tone={notice.tone} />
            <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>{list.length + (list.length === 1 ? ' subject' : ' subjects')}</Text>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="book" title="No subjects yet" message="Add your first subject above." />}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {editing === item.id ? (
              <>
                <TextInput value={editName} onChangeText={setEditName} autoFocus style={styles.edit} returnKeyType="done" onSubmitEditing={() => saveEdit(item.id)} />
                <Pressable onPress={() => saveEdit(item.id)} hitSlop={8} style={styles.iconBtn}>
                  <Icon name="check" size={20} color={colors.success} />
                </Pressable>
                <Pressable onPress={() => setEditing('')} hitSlop={8} style={styles.iconBtn}>
                  <Icon name="close" size={20} color={colors.textMuted} />
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]}>{item.name}</Text>
                <Pressable
                  onPress={() => {
                    setEditing(item.id);
                    setEditName(item.name);
                  }}
                  hitSlop={8}
                  style={styles.iconBtn}>
                  <Icon name="edit" size={19} color={colors.primary} />
                </Pressable>
                <Pressable onPress={() => remove(item)} hitSlop={8} style={styles.iconBtn}>
                  <Icon name="trash" size={19} color={colors.danger} />
                </Pressable>
              </>
            )}
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, minHeight: 56 },
  edit: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 12, fontFamily: fonts.medium, fontSize: 16, color: colors.text, paddingVertical: 0 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
