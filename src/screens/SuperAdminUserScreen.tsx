import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Avatar, Button, Card, Input, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { confirmAction } from '../lib/confirm';
import { supabase } from '../lib/supabase';
import { fetchUserDetail, manageUser } from '../lib/superAdmin';

const ROLE: Record<string, string> = { owner: 'School owner', teacher_admin: 'Teacher admin', teacher: 'Teacher' };

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={[text.small, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[text.body, { color: colors.text }]} selectable>{value || 'Not set'}</Text>
    </View>
  );
}

export default function SuperAdminUserScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const userId: string = route.params.userId;
  const [data, setData] = useState<{ profile: any; memberships: any[] } | null>(null);
  const [me, setMe] = useState('');
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getSession();
      setMe(auth.session ? auth.session.user.id : '');
      setData(await fetchUserDetail(userId));
    } catch (e: any) {
      setLoadError(e.message);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const act = async (key: 'block' | 'unblock' | 'delete', success: string, after?: () => void) => {
    setMsg({ message: '', tone: 'success' });
    setBusy(key);
    try {
      await manageUser(key, userId, reason.trim());
      setMsg({ message: success, tone: 'success' });
      if (after) {
        after();
      } else {
        setReason('');
        await load();
      }
    } catch (e: any) {
      setMsg({ message: e && e.message ? e.message : 'Something went wrong.', tone: 'error' });
    }
    setBusy('');
  };

  if (loadError) {
    return (
      <Screen>
        <Notice message={loadError} tone="error" />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        <Skeleton height={200} radius={24} />
      </Screen>
    );
  }

  const p = data.profile;
  const own = p.id === me;
  const protectedUser = own || p.is_super_admin === true;
  const label = p.full_name || p.email || 'this user';
  const typed = confirmText.trim().toLowerCase();
  const confirmOk = typed.length > 0 && (typed === (p.email || '').toLowerCase() || typed === (p.full_name || '').toLowerCase());

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <Avatar name={p.full_name} uri={p.avatar_url || undefined} size={72} />
          <Text style={[text.h2, { color: colors.text, marginTop: spacing.md, textAlign: 'center' }]}>{p.full_name || 'No name'}</Text>
          {p.is_blocked ? <Text style={[styles.pill, { color: colors.danger, backgroundColor: colors.dangerSoft }]}>Blocked</Text> : null}
          {p.is_super_admin ? <Text style={[styles.pill, { color: colors.primary, backgroundColor: colors.primarySoft }]}>Super admin</Text> : null}
        </View>

        <Notice message={msg.message} tone={msg.tone} />

        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Profile</Text>
          <Line label="Email" value={p.email} />
          <Line label="Phone" value={p.phone} />
          <Line label="Joined" value={p.created_at ? new Date(p.created_at).toLocaleDateString() : ''} />
          <Line label="Referral code" value={p.referral_code} />
          {p.is_blocked && p.blocked_reason ? <Line label="Blocked because" value={p.blocked_reason} /> : null}
        </Card>

        <Card style={styles.block}>
          <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Schools</Text>
          {data.memberships.length === 0 ? (
            <Text style={[text.small, { color: colors.textMuted }]}>Not a member of any school.</Text>
          ) : (
            data.memberships.map(m => (
              <View key={m.id} style={styles.line}>
                <Text style={[text.bodyStrong, { color: colors.text }]}>{m.schools ? m.schools.name : 'Unknown school'}</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{(ROLE[m.role] || m.role) + (m.is_active ? '' : ', not approved or inactive')}</Text>
              </View>
            ))
          )}
        </Card>

        {protectedUser ? (
          <Card style={styles.block}>
            <Text style={[text.small, { color: colors.textMuted }]}>
              {own ? 'This is your own account, so it cannot be blocked or deleted here.' : 'Super admin accounts cannot be blocked or deleted here.'}
            </Text>
          </Card>
        ) : (
          <>
            <Card style={styles.block}>
              <Text style={[text.h3, { color: colors.text }]}>{p.is_blocked ? 'Blocked user' : 'Block user'}</Text>
              <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>
                {p.is_blocked
                  ? 'This person cannot sign in. Unblock them to give access back.'
                  : 'A blocked person is signed out and cannot sign in again. Their data stays safe and you can unblock them any time.'}
              </Text>
              {p.is_blocked ? (
                <Button title="Unblock user" variant="outline" loading={busy === 'unblock'} onPress={() => act('unblock', 'User unblocked.')} />
              ) : (
                <View>
                  <Input label="Reason (optional)" value={reason} onChangeText={setReason} />
                  <Button
                    title="Block user"
                    variant="danger"
                    loading={busy === 'block'}
                    onPress={() => confirmAction('Block user', label + ' will be signed out and unable to sign in.', 'Block', () => act('block', 'User blocked.'))}
                  />
                </View>
              )}
            </Card>

            <Card style={[styles.block, { borderColor: colors.danger, borderWidth: 1 }]}>
              <Text style={[text.h3, { color: colors.danger }]}>Delete user</Text>
              <Text style={[text.small, { color: colors.textMuted, marginVertical: spacing.md }]}>
                Permanently removes this account and profile from the app and the backend. This cannot be undone. School owners and people with payment records cannot be deleted. Block them instead.
              </Text>
              <Input label="Type their email or full name to confirm" value={confirmText} onChangeText={setConfirmText} autoCapitalize="none" />
              <Button
                title="Delete user permanently"
                variant="danger"
                disabled={!confirmOk}
                loading={busy === 'delete'}
                onPress={() => confirmAction('Delete user', 'Delete ' + label + ' forever? This cannot be undone.', 'Delete forever', () => act('delete', 'User deleted.', () => navigation.goBack()))}
              />
            </Card>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  head: { alignItems: 'center', marginBottom: spacing.lg, gap: 6 },
  pill: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  block: { marginBottom: spacing.xl },
  line: { paddingVertical: spacing.sm },
});
