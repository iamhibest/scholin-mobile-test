import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Avatar, Icon, Notice, Screen, SearchBar, Skeleton } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { fetchUsers, USERS_PAGE } from '../lib/superAdmin';

export default function SuperAdminUsersScreen() {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<any[] | null>(null);
  const [more, setMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(0);
  const current = useRef('');

  const load = useCallback(async (q: string) => {
    const ticket = ++latest.current;
    try {
      setError('');
      const rows = await fetchUsers(q, 0);
      if (ticket !== latest.current) {
        return;
      }
      setUsers(rows);
      setMore(rows.length === USERS_PAGE);
    } catch (e: any) {
      if (ticket === latest.current) {
        setUsers(prev => prev || []);
        setError(e && e.message ? e.message : 'Could not load users.');
      }
    }
  }, []);

  useEffect(() => {
    current.current = query;
    const timer = setTimeout(() => load(query), 350);
    return () => clearTimeout(timer);
  }, [query, load]);

  useFocusEffect(
    useCallback(() => {
      if (users) {
        load(current.current);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  const loadMore = async () => {
    if (!users || loadingMore || !more) {
      return;
    }
    setLoadingMore(true);
    try {
      const rows = await fetchUsers(query, users.length);
      setUsers([...users, ...rows]);
      setMore(rows.length === USERS_PAGE);
    } catch (e: any) {
      setError(e && e.message ? e.message : 'Could not load more.');
    }
    setLoadingMore(false);
  };

  return (
    <Screen padded={false}>
      <View style={styles.top}>
        <SearchBar value={query} onChange={setQuery} placeholder="Search name, email or phone" />
        <Notice message={error} tone="error" />
      </View>
      {users === null ? (
        <View style={{ paddingHorizontal: spacing.xl }}>
          <Skeleton height={80} radius={20} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => u.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<Text style={[text.body, { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl }]}>No users found.</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: spacing.lg }} color={colors.primary} /> : null}
          renderItem={({ item: u }) => (
            <Pressable onPress={() => navigation.navigate('SuperAdminUser', { userId: u.id, name: u.full_name })} style={styles.row}>
              <Avatar name={u.full_name || ''} uri={u.avatar_url || undefined} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{u.full_name || 'No name'}</Text>
                <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>{u.email || 'No email'}</Text>
                <View style={styles.tags}>
                  {u.is_super_admin ? <Text style={[styles.tag, { color: colors.primary, backgroundColor: colors.primarySoft }]}>Super admin</Text> : null}
                  {u.is_blocked ? <Text style={[styles.tag, { color: colors.danger, backgroundColor: colors.dangerSoft }]}>Blocked</Text> : null}
                </View>
              </View>
              <Icon name="chevron" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  tags: { flexDirection: 'row', gap: 6, marginTop: 4 },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' },
});
