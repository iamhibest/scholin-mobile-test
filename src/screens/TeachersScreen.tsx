import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Avatar, Badge, Button, Card, EmptyState, Icon, Screen, Skeleton } from '../components';
import { IconName } from '../components/Icon';
import { toneColors } from '../components/QuickTile';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { confirmAction, showError } from '../lib/confirm';
import { approveRequest, fetchMembers, removeMember, setMemberPermission, setMemberRole } from '../lib/school';

type Perm = { field: string; label: string; desc: string; icon: IconName; tone: keyof typeof toneColors; adminOnly?: boolean };

const PERMISSIONS: Perm[] = [
  { field: 'can_edit_results', label: 'Edit results', desc: "Can edit students' results", icon: 'file', tone: 'blue' },
  { field: 'can_generate_report_cards', label: 'Generate report cards', desc: 'Can generate report cards', icon: 'fileCheck', tone: 'purple' },
  { field: 'can_add_comments', label: 'Add comments', desc: 'Can add comments on results', icon: 'chat', tone: 'green' },
  { field: 'can_manage_permissions', label: "Manage teachers' permissions", desc: 'Can change the permissions of regular teachers. Only you (the school owner) can switch this on.', icon: 'shieldCheck', tone: 'rose', adminOnly: true },
  { field: 'can_manage_events_fees', label: 'Manage events and fees', desc: 'Can view and manage Events and Fees, including recording payments', icon: 'wallet', tone: 'teal', adminOnly: true },
  { field: 'can_mark_attendance', label: 'Mark attendance register', desc: 'Can mark the attendance register', icon: 'calendarCheck', tone: 'amber' },
  { field: 'can_manage_attendance', label: 'Manage staff attendance', desc: 'Can manage staff attendance', icon: 'users', tone: 'teal' },
  { field: 'can_manage_qr_codes', label: 'Manage attendance QR codes', desc: 'Can manage attendance QR codes', icon: 'qr', tone: 'blue' },
  { field: 'can_view_attendance_reports', label: 'View attendance reports', desc: 'Can view attendance reports', icon: 'trend', tone: 'purple' },
  { field: 'receive_attendance_notifications', label: 'Attendance notifications', desc: 'Receives attendance notifications', icon: 'bell', tone: 'amber' },
];

const roleLabel = (r: string) => (r === 'owner' ? 'School Owner' : r === 'teacher_admin' ? 'Teacher Admin' : 'Teacher');

export default function TeachersScreen({ navigation }: any) {
  const { ctx, loading: ctxLoading } = useStaff();
  const [tab, setTab] = useState<'active' | 'pending'>('active');
  const [active, setActive] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      const [a, p] = await Promise.all([fetchMembers(ctx.schoolId, true), fetchMembers(ctx.schoolId, false)]);
      setActive(a);
      setPending(p);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const run = async (job: () => Promise<void>) => {
    try {
      await job();
      await load();
    } catch (e: any) {
      showError(e.message);
    }
  };

  const toggle = async (member: any, field: string, value: boolean) => {
    setActive(list => list.map(m => (m.id === member.id ? { ...m, [field]: value } : m)));
    try {
      await setMemberPermission(member.id, field, value);
    } catch (e: any) {
      setActive(list => list.map(m => (m.id === member.id ? { ...m, [field]: !value } : m)));
      showError(e.message);
    }
  };

  if (!ctxLoading && ctx && !ctx.isAdmin) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Admins only" message="Only the school owner and teacher admins can manage teachers and roles." />
      </Screen>
    );
  }

  if (ctxLoading || loading) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={48} radius={24} />
          <Skeleton height={150} radius={24} />
          <Skeleton height={150} radius={24} />
        </View>
      </Screen>
    );
  }

  const renderMember = (m: any) => {
    const prof = m.profiles || { full_name: 'Unknown user', email: '', phone: '', avatar_url: '' };
    const isMe = ctx ? m.id === ctx.membership.id : false;
    const myRole = ctx ? ctx.role : 'teacher';
    const canManage = (myRole === 'owner' && m.role !== 'owner') || (myRole === 'teacher_admin' && m.role === 'teacher');
    // Make admin / Remove admin: owner and teacher admins, never on yourself and never on the owner.
    const canChangeRole = !isMe && m.role !== 'owner' && (myRole === 'owner' || myRole === 'teacher_admin');
    const delegated = ctx ? ctx.membership.can_manage_permissions === true : false;
    // Only the owner sees the owner-only switches (events and fees, manage permissions) and only for teacher admins.
    // A teacher admin never sees permissions for themselves, for other admins, or any owner-only switch.
    const canEditPerms = myRole === 'owner' ? m.role !== 'owner' : myRole === 'teacher_admin' && delegated && m.role === 'teacher' && !isMe;
    const hasPerms = (m.role === 'teacher' || m.role === 'teacher_admin') && canEditPerms;
    const perms = PERMISSIONS.filter(p => (m.role === 'teacher_admin' ? p.adminOnly === true : !p.adminOnly)).filter(p => !p.adminOnly || myRole === 'owner');
    const expanded = !!open[m.id];
    return (
      <Card key={m.id} style={styles.card}>
        <View style={styles.top}>
          <Avatar name={prof.full_name} uri={prof.avatar_url || undefined} size={56} />
          <View style={{ flex: 1 }}>
            <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{prof.full_name + (isMe ? ' (you)' : '')}</Text>
            <View style={{ marginTop: 4 }}>
              <Badge label={roleLabel(m.role)} tone={m.role === 'teacher' ? 'blue' : 'purple'} />
            </View>
          </View>
        </View>
        {prof.email ? (
          <View style={styles.contact}>
            <Icon name="mail" size={16} color={colors.textMuted} />
            <Text style={[text.small, { color: colors.textMuted, flex: 1 }]} numberOfLines={1}>{prof.email}</Text>
          </View>
        ) : null}
        {prof.phone ? (
          <View style={styles.contact}>
            <Icon name="phone" size={16} color={colors.textMuted} />
            <Text style={[text.small, { color: colors.textMuted }]}>{prof.phone}</Text>
          </View>
        ) : null}

        {canManage || canChangeRole ? (
          <View style={styles.actions}>
            {canManage ? <Button title="Edit" icon="edit" variant="soft" style={styles.action} onPress={() => navigation.navigate('TeacherEdit', { profileId: m.profile_id, name: prof.full_name, phone: prof.phone || '', avatar: prof.avatar_url || '' })} /> : null}
            {canChangeRole && m.role === 'teacher' ? (
              <Button
                title="Make admin"
                icon="shield"
                variant="outline"
                style={styles.action}
                onPress={() => confirmAction('Make Teacher Admin', 'They will gain access to most administration features.', 'Make admin', () => run(() => setMemberRole(m.id, 'teacher_admin')), false)}
              />
            ) : null}
            {canChangeRole && m.role === 'teacher_admin' ? (
              <Button
                title="Remove admin access"
                variant="outline"
                style={styles.action}
                onPress={() => confirmAction('Remove admin access', 'They will return to a regular Teacher role.', 'Remove access', () => run(() => setMemberRole(m.id, 'teacher')))}
              />
            ) : null}
            {canManage ? <Button
              title="Remove"
              icon="trash"
              variant="danger"
              style={styles.action}
              onPress={() => confirmAction('Remove from school', 'Permanently remove ' + prof.full_name + ' from this school? This cannot be undone.', 'Remove', () => run(() => removeMember(m.id)))}
            /> : null}
          </View>
        ) : null}

        {hasPerms ? (
          <>
            <Pressable onPress={() => setOpen(o => ({ ...o, [m.id]: !o[m.id] }))} style={styles.permsHead}>
              <Icon name="shieldCheck" size={18} color={colors.primary} />
              <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]}>Permissions</Text>
              <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}>
                <Icon name="chevronDown" size={20} color={colors.textMuted} />
              </View>
            </Pressable>
            {expanded
              ? perms.map(p => {
                  const t = toneColors[p.tone];
                  return (
                    <View key={p.field} style={styles.perm}>
                      <View style={[styles.permIcon, { backgroundColor: t.bg }]}>
                        <Icon name={p.icon} size={18} color={t.fg} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[text.bodyStrong, { color: colors.text }]}>{p.label}</Text>
                        <Text style={[text.small, { color: colors.textMuted }]}>{p.desc}</Text>
                      </View>
                      <Switch
                        value={!!m[p.field]}
                        onValueChange={v => toggle(m, p.field, v)}
                                                trackColor={{ false: '#D5D8DE', true: colors.primaryLight }}
                        thumbColor={m[p.field] ? colors.primary : '#FFFFFF'}
                      />
                    </View>
                  );
                })
              : null}
          </>
        ) : null}
      </Card>
    );
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}>
        <View style={styles.tabs}>
          {(['active', 'pending'] as const).map(t => {
            const on = tab === t;
            const label = t === 'active' ? 'Active (' + active.length + ')' : 'Requests (' + pending.length + ')';
            return (
              <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, on && styles.tabOn]}>
                <Text style={[text.bodyStrong, { color: on ? colors.primary : colors.textMuted }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {failed ? <EmptyState icon="info" title="Could not load teachers" message="Pull down to try again." /> : null}

        {!failed && tab === 'active' ? (active.length ? active.map(renderMember) : <EmptyState icon="users" title="No teachers yet" message="Teachers who join your school will appear here." />) : null}

        {!failed && tab === 'pending' ? (
          pending.length ? (
            pending.map(p => {
              const prof = p.profiles || { full_name: 'Unknown user', email: '', phone: '', avatar_url: '' };
              return (
                <Card key={p.id} style={styles.card}>
                  <View style={styles.top}>
                    <Avatar name={prof.full_name} uri={prof.avatar_url || undefined} size={56} />
                    <View style={{ flex: 1 }}>
                      <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{prof.full_name}</Text>
                      {prof.email ? <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>{prof.email}</Text> : null}
                      {prof.phone ? <Text style={[text.small, { color: colors.textMuted }]}>{prof.phone}</Text> : null}
                    </View>
                  </View>
                  <View style={styles.actions}>
                    <Button title="Approve" style={styles.action} onPress={() => run(() => approveRequest(p.id))} />
                    <Button
                      title="Decline"
                      variant="danger"
                      style={styles.action}
                      onPress={() => confirmAction('Decline request', 'Decline and remove this join request?', 'Decline', () => run(() => removeMember(p.id)))}
                    />
                  </View>
                </Card>
              );
            })
          ) : (
            <EmptyState icon="inbox" title="No pending requests" message="When a teacher requests to join your school, they will appear here for approval." />
          )
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  tabs: { flexDirection: 'row', backgroundColor: '#EDEEF0', borderRadius: radius.pill, padding: 4, marginBottom: spacing.lg },
  tab: { flex: 1, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.surface },
  card: { marginBottom: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  action: { flexGrow: 1, flexBasis: '45%', height: 44 },
  permsHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  perm: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  permIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
