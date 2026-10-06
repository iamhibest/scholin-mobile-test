import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Input, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { confirmAction } from '../lib/confirm';
import { supabase } from '../lib/supabase';
import { deleteBroadcast, fetchBroadcasts, postBroadcast, updateBroadcast } from '../lib/superAdmin';

type Msg = { message: string; tone: 'error' | 'success' };
const none: Msg = { message: '', tone: 'success' };

export default function SuperAdminBroadcastsScreen() {
  const [items, setItems] = useState<any[] | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState('');
  const [eTitle, setETitle] = useState('');
  const [eBody, setEBody] = useState('');
  const [busy, setBusy] = useState('');
  const [postMsg, setPostMsg] = useState<Msg>(none);
  const [listMsg, setListMsg] = useState<Msg>(none);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchBroadcasts());
    } catch (e: any) {
      setItems(prev => prev || []);
      setListMsg({ message: e.message, tone: 'error' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const post = () => {
    setPostMsg(none);
    if (!title.trim()) {
      setPostMsg({ message: 'Please enter a title.', tone: 'error' });
      return;
    }
    confirmAction('Send broadcast', 'This will be sent to every school on Scholin.', 'Send', async () => {
      setBusy('post');
      try {
        const { data } = await supabase.auth.getSession();
        await postBroadcast(data.session ? data.session.user.id : '', title.trim(), body.trim());
        setTitle('');
        setBody('');
        setPostMsg({ message: 'Broadcast sent to all schools.', tone: 'success' });
        await load();
      } catch (e: any) {
        setPostMsg({ message: e.message, tone: 'error' });
      }
      setBusy('');
    }, false);
  };

  const startEdit = (a: any) => {
    setEditing(a.id);
    setETitle(a.title || '');
    setEBody(a.body || '');
    setListMsg(none);
  };

  const saveEdit = async (id: string) => {
    if (!eTitle.trim()) {
      setListMsg({ message: 'Please enter a title.', tone: 'error' });
      return;
    }
    setBusy(id);
    try {
      await updateBroadcast(id, eTitle.trim(), eBody.trim());
      setEditing('');
      await load();
    } catch (e: any) {
      setListMsg({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  const remove = (a: any) => {
    confirmAction('Delete broadcast', "It will disappear from every school's dashboard.", 'Delete', async () => {
      try {
        await deleteBroadcast(a.id);
        await load();
      } catch (e: any) {
        setListMsg({ message: e.message, tone: 'error' });
      }
    });
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text }]}>New broadcast</Text>
          <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>Goes to every school and sends a push notification.</Text>
          <Notice message={postMsg.message} tone={postMsg.tone} />
          <Input label="Title" value={title} onChangeText={setTitle} placeholder="What is this about?" />
          <Input label="Message" value={body} onChangeText={setBody} multiline textAlignVertical="top" placeholder="Write your message" style={{ minHeight: 110 }} />
          <Button title="Send to all schools" loading={busy === 'post'} onPress={post} />
        </Card>

        <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Past broadcasts</Text>
        <Notice message={listMsg.message} tone={listMsg.tone} />
        {items === null ? (
          <Skeleton height={120} radius={20} />
        ) : items.length === 0 ? (
          <Card>
            <Text style={[text.bodyStrong, { color: colors.text }]}>No broadcasts yet</Text>
            <Text style={[text.small, { color: colors.textMuted, marginTop: 4 }]}>Send your first one above.</Text>
          </Card>
        ) : (
          items.map(a => (
            <Card key={a.id} style={styles.card}>
              <Text style={[text.caption, { color: colors.textMuted }]}>{new Date(a.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</Text>
              {editing === a.id ? (
                <View style={{ marginTop: spacing.sm }}>
                  <Input label="Title" value={eTitle} onChangeText={setETitle} />
                  <Input label="Message" value={eBody} onChangeText={setEBody} multiline textAlignVertical="top" style={{ minHeight: 100 }} />
                  <View style={styles.actions}>
                    <Button title="Save changes" loading={busy === a.id} onPress={() => saveEdit(a.id)} />
                    <Button title="Cancel" variant="outline" onPress={() => setEditing('')} />
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={[text.bodyStrong, { color: colors.text, marginTop: 4 }]}>{a.title}</Text>
                  {a.body ? <Text style={[text.small, { color: colors.textMuted, marginTop: 4 }]}>{a.body}</Text> : null}
                  <View style={styles.actions}>
                    <Button title="Edit" variant="outline" onPress={() => startEdit(a)} />
                    <Button title="Delete" variant="soft" onPress={() => remove(a)} />
                  </View>
                </View>
              )}
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  block: { marginBottom: spacing.xl },
  card: { marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
