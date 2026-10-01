import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar, Button, Card, EmptyState, FadeIn, Input, SectionTitle, SideMenu, Skeleton, StatCard, TopBar } from '../components';
import { MenuGroup } from '../components/SideMenu';
import { colors, fonts, radius, shadow, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { shortDate } from '../lib/format';
import { loadSuperAdmin, SchoolRow } from '../lib/superadmin';

const links = [
  'Attendance Monitor', 'Referral Program', 'Broadcast Announcement', 'Vacancy Pricing', 'Subscription Pricing',
  'Fee Payment Commission', 'Payment Terms of Use', 'School Finance', 'Subscriptions', 'Terms and About', 'App Version',
];

export default function SuperAdminHomeScreen({ navigation }: any) {
  const [state, setState] = useState<{ schools: SchoolRow[]; teachers: number; students: number; failed: boolean } | null>(null);
  const [term, setTerm] = useState('');
  const [menu, setMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await loadSuperAdmin());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    const list = state ? state.schools : [];
    return t ? list.filter(s => s.name.toLowerCase().includes(t)) : list;
  }, [state, term]);

  async function signOut() {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  const go = (title: string) => navigation.navigate('Feature', { title });

  const groups: MenuGroup[] = [
    {
      title: 'Navigation',
      items: [
        { label: 'All Schools', icon: 'school', active: true, onPress: () => {} },
        { label: 'Developer tools', icon: 'bug' as const, onPress: () => navigation.navigate('Developer') },
        ...links.map(l => ({ label: l, icon: 'chevron' as const, onPress: () => (l === 'Terms and About' ? navigation.navigate('Terms') : go(l)) })),
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <TopBar onMenu={() => setMenu(true)} title="Scholin Admin" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}>
        <FadeIn>
          <Text style={[text.h1, { color: colors.primary }]}>All registered schools</Text>
          <Text style={[text.body, { color: colors.textMuted, marginTop: 2 }]}>Everything happening across Scholin, in one place.</Text>
        </FadeIn>

        <FadeIn delay={80} style={styles.stats}>
          <StatCard style={{ flex: 1 }} tone="blue" icon="school" label="Schools" value={state ? String(state.schools.length) : '-'} />
          <StatCard style={{ flex: 1 }} tone="purple" icon="userCog" label="Staff" value={state ? String(state.teachers) : '-'} />
          <StatCard style={{ flex: 1 }} tone="green" icon="users" label="Students" value={state ? String(state.students) : '-'} />
        </FadeIn>

        <SectionTitle title="Registered schools" />
        <Input label="Search schools" icon="search" value={term} onChangeText={setTerm} placeholder="Type a school name" />

        {!state ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={96} radius={20} />
            <Skeleton height={96} radius={20} />
          </View>
        ) : state.failed ? (
          <EmptyState title="Could not load schools" message="Check your connection and try again." actionLabel="Try again" onAction={load} />
        ) : filtered.length === 0 ? (
          <EmptyState icon="school" title={term ? 'No school found with that name' : 'No schools registered yet'} message={term ? undefined : "Once school owners sign up and register, they'll appear here."} />
        ) : (
          <View style={{ gap: spacing.md }}>
            {filtered.map((s, i) => (
              <FadeIn key={s.id} delay={Math.min(i, 8) * 40}>
                <View style={[styles.school, shadow.soft]}>
                  <View style={styles.top}>
                    <Avatar name={s.name} size={46} />
                    <View style={{ flex: 1 }}>
                      <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{s.name}</Text>
                      <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>{s.address || 'No address on file'}</Text>
                    </View>
                  </View>
                  <View style={styles.meta}>
                    <Text style={[text.small, { color: colors.textMuted }]}>{s.phone || 'No phone'}</Text>
                    <Text style={[text.small, { color: colors.textMuted }]}>Registered {shortDate(s.created_at)}</Text>
                  </View>
                  <Button title="Manage" variant="soft" onPress={() => go('Manage School')} style={styles.manage} />
                </View>
              </FadeIn>
            ))}
          </View>
        )}
      </ScrollView>

      <SideMenu visible={menu} onClose={() => setMenu(false)} groups={groups} footer={{ label: 'Sign out', icon: 'logout', onPress: signOut }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, paddingTop: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl },
  school: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  manage: { height: 44, marginTop: spacing.md },
});
