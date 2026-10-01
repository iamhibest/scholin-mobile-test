import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Avatar, Button, EmptyState, Input, Notice, Screen, Skeleton } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

type School = { id: string; name: string; address?: string; logo_url?: string };

export default function JoinSchoolScreen({ navigation }: any) {
  const [schools, setSchools] = useState<School[]>([]);
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [ok, setOk] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    let joined: string[] = [];
    if (userId) {
      const { data: mine } = await supabase.from('school_members').select('school_id').eq('profile_id', userId);
      joined = (mine || []).map((m: any) => m.school_id);
    }
    const { data, error } = await supabase.from('schools').select('id, name, address, logo_url').order('name', { ascending: true });
    if (error) {
      setFailed(true);
    } else {
      setFailed(false);
      setSchools((data || []).filter((s: School) => !joined.includes(s.id)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    return t ? schools.filter(s => s.name.toLowerCase().includes(t)) : schools;
  }, [schools, term]);

  async function join(school: School) {
    setMsg('');
    setOk(false);
    setSending(school.id);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('school_members').insert({
        school_id: school.id,
        profile_id: auth.user?.id,
        role: 'teacher',
        can_edit_results: false,
        can_generate_report_cards: false,
        can_add_comments: false,
        is_active: false,
      });
      if (error) {
        setMsg(error.message || 'Could not send request.');
        return;
      }
      setOk(true);
      setMsg('Request sent! You will get access once your school admin approves you.');
      setTimeout(() => navigation.reset({ index: 0, routes: [{ name: 'PendingApproval' }] }), 1800);
    } catch (e: any) {
      logger.error('Join school failed: ' + e.message);
      setMsg('Something went wrong. Please try again.');
    } finally {
      setSending(null);
    }
  }

  return (
    <Screen padded={false} background={colors.surface}>
      <FlatList
        data={loading || failed ? [] : filtered}
        keyExtractor={s => s.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.xl }}
        ListHeaderComponent={
          <View>
            <Text style={[text.h1, { color: colors.primary }]}>Join your school</Text>
            <Text style={[text.body, { color: colors.textMuted, marginTop: 4, marginBottom: spacing.xl }]}>
              Find your school below, or search by name. Your school's admin will need to approve you before you can access anything.
            </Text>
            <Notice message={msg} tone={ok ? 'success' : 'error'} />
            <Input label="Search schools" icon="search" value={term} onChangeText={setTerm} placeholder="Start typing to filter" />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: spacing.md }}>
              <Skeleton height={64} radius={16} />
              <Skeleton height={64} radius={16} />
              <Skeleton height={64} radius={16} />
            </View>
          ) : failed ? (
            <EmptyState title="Could not load schools" message="Check your connection and try again." actionLabel="Try again" onAction={load} />
          ) : (
            <EmptyState icon="school" title={term ? 'No school found with that name' : 'No schools have registered yet'} />
          )
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Avatar name={item.name} uri={item.logo_url} size={46} />
            <View style={styles.info}>
              <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>{item.address || 'No address on file'}</Text>
            </View>
            <Button title="Join" onPress={() => join(item)} loading={sending === item.id} disabled={!!sending} style={styles.join} />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  info: { flex: 1 },
  join: { height: 42, paddingHorizontal: 20, borderRadius: radius.md },
});
