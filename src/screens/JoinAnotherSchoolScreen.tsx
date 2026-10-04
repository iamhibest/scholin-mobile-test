import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, Notice, SchoolMark, Screen, SearchBar, Skeleton } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { fetchJoinableSchools, requestToJoin } from '../lib/account';

export default function JoinAnotherSchoolScreen() {
  const [uid, setUid] = useState('');
  const [schools, setSchools] = useState<any[] | null>(null);
  const [sent, setSent] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const id = data.session?.user?.id;
        if (!id) {
          return;
        }
        setUid(id);
        setSchools(await fetchJoinableSchools(id));
      } catch (e: any) {
        setSchools([]);
        setNotice({ message: e.message, tone: 'error' });
      }
    })();
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (schools || []).filter(s => !q || String(s.name).toLowerCase().includes(q));
  }, [schools, query]);

  const join = async (id: string) => {
    setBusy(id);
    setNotice({ message: '', tone: 'success' });
    try {
      await requestToJoin(uid, id);
      setSent(prev => prev.concat(id));
      setNotice({ message: 'Request sent. You will get access once the school admin approves you. You can keep using your other schools meanwhile.', tone: 'success' });
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  if (schools === null) {
    return (
      <Screen>
        <Skeleton height={50} radius={25} />
        <Skeleton height={80} radius={20} style={{ marginTop: spacing.lg }} />
        <Skeleton height={80} radius={20} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={list}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>Find your school and send a join request.</Text>
            <SearchBar value={query} onChange={setQuery} placeholder="Search schools" />
            <View style={{ marginTop: spacing.md }}>
              <Notice message={notice.message} tone={notice.tone} />
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="school" title={query ? 'No school found' : 'No other schools'} message={query ? 'No school found with that name.' : 'No other schools available to join.'} />}
        renderItem={({ item }) => {
          const done = sent.includes(item.id);
          return (
            <View style={styles.row}>
              <SchoolMark name={item.name} uri={item.logo_url} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
                <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>{item.address || 'No address on file'}</Text>
              </View>
              <Button title={done ? 'Sent' : 'Join'} variant={done ? 'soft' : 'primary'} disabled={done} loading={busy === item.id} onPress={() => join(item.id)} style={{ minWidth: 76, height: 42, paddingHorizontal: 14 }} />
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: '#EEF1F6' },
});
