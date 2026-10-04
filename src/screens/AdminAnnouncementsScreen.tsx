import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BottomSheet, Button, Card, EmptyState, Input, Notice, Screen, ShineButton, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { confirmAction } from '../lib/confirm';
import { shortDate } from '../lib/format';
import { deleteAnnouncement, fetchSchoolAnnouncements, postAnnouncement, updateAnnouncement } from '../lib/announcements';

type Tone = { message: string; tone: 'error' | 'success' };

function Row({ a, index, onView, onEdit, onDelete }: any) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 380, delay: Math.min(index, 6) * 55, useNativeDriver: true }).start();
  }, [enter, index]);
  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
      <Card style={{ marginBottom: spacing.md }}>
        <Text style={[text.caption, { color: colors.textMuted }]}>{shortDate(a.created_at)}</Text>
        <Text style={[text.bodyStrong, { color: colors.text, marginTop: 2 }]}>{a.title}</Text>
        {a.body ? <Text style={[text.small, { color: colors.textMuted, marginTop: 4 }]} numberOfLines={3}>{a.body}</Text> : null}
        <View style={styles.actions}>
          <Button title="View" variant="soft" onPress={onView} style={styles.action} />
          <Button title="Edit" variant="soft" onPress={onEdit} style={styles.action} />
          <Button title="Delete" variant="danger" onPress={onDelete} style={styles.action} />
        </View>
      </Card>
    </Animated.View>
  );
}

export default function AdminAnnouncementsScreen({ navigation }: any) {
  const { ctx, loading: ctxLoading } = useStaff();
  const [items, setItems] = useState<any[] | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Tone>({ message: '', tone: 'success' });
  const [edit, setEdit] = useState<any | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eBody, setEBody] = useState('');
  const [eMsg, setEMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      setItems(await fetchSchoolAnnouncements(ctx.schoolId));
    } catch (e: any) {
      setItems([]);
      setNotice({ message: e.message, tone: 'error' });
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (ctxLoading || (ctx && items === null)) {
    return (
      <Screen>
        <Skeleton height={260} radius={20} />
        <Skeleton height={120} radius={20} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (!ctx || !ctx.isAdmin) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Admins only" message="Only the school owner and teacher admins can post announcements." />
      </Screen>
    );
  }

  const post = async () => {
    setNotice({ message: '', tone: 'success' });
    if (!title.trim()) {
      setNotice({ message: 'Please enter a title.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      await postAnnouncement(ctx.schoolId, ctx.userId, title.trim(), body.trim());
      setTitle('');
      setBody('');
      setNotice({ message: 'Announcement posted.', tone: 'success' });
      await load();
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy(false);
  };

  const openEdit = (a: any) => {
    setEdit(a);
    setETitle(a.title);
    setEBody(a.body || '');
    setEMsg('');
  };

  const saveEdit = async () => {
    if (!edit) {
      return;
    }
    if (!eTitle.trim()) {
      setEMsg('Please enter a title.');
      return;
    }
    setSaving(true);
    try {
      await updateAnnouncement(edit.id, eTitle.trim(), eBody.trim());
      setEdit(null);
      await load();
    } catch (e: any) {
      setEMsg(e.message);
    }
    setSaving(false);
  };

  const remove = (a: any) =>
    confirmAction('Delete announcement', 'This announcement will be removed for everyone.', 'Delete', async () => {
      try {
        await deleteAnnouncement(a.id);
        await load();
      } catch (e: any) {
        setNotice({ message: e.message, tone: 'error' });
      }
    });

  const list = items || [];

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <Notice message={notice.message} tone={notice.tone} />
        <View style={styles.compose}>
          <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>New announcement</Text>
          <Input label="Title" value={title} onChangeText={setTitle} placeholder="For example Mid term break resumes Monday" maxLength={150} />
          <Input label="Message" value={body} onChangeText={setBody} multiline placeholder="Write your announcement" style={{ minHeight: 110, textAlignVertical: 'top' }} />
          <Text style={[text.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>{body.length + (body.length === 1 ? ' character' : ' characters')}</Text>
          <ShineButton title="Post announcement" icon="send" loading={busy} onPress={post} />
        </View>

        <View style={styles.listHead}>
          <Text style={[text.h3, { color: colors.text }]}>Posted announcements</Text>
          <View style={styles.count}>
            <Text style={styles.countText}>{list.length}</Text>
          </View>
        </View>

        <Button title="See the full announcement feed" variant="ghost" onPress={() => navigation.navigate('Announcements')} style={{ marginBottom: spacing.sm }} />
        {list.length === 0 ? <EmptyState icon="megaphone" title="No announcements yet" message="Post your first announcement above." /> : null}
        {list.map((a, i) => (
          <Row key={a.id} a={a} index={i} onView={() => navigation.navigate('AnnouncementDetail', { id: a.id })} onEdit={() => openEdit(a)} onDelete={() => remove(a)} />
        ))}
      </ScrollView>

      <BottomSheet visible={!!edit} onClose={() => setEdit(null)} title="Edit announcement">
        <Notice message={eMsg} tone="error" />
        <Input label="Title" value={eTitle} onChangeText={setETitle} maxLength={150} />
        <Input label="Message" value={eBody} onChangeText={setEBody} multiline style={{ minHeight: 120, textAlignVertical: 'top' }} />
        <Button title="Save changes" loading={saving} onPress={saveEdit} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  compose: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: '#EEF1F6' },
  listHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl, marginBottom: spacing.md },
  count: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  countText: { color: colors.primary, fontSize: 12.5, fontFamily: fonts.bold },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  action: { flex: 1, minWidth: 0, height: 42, paddingHorizontal: 8 },
});
