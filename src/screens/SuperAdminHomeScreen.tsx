import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Icon, Notice, Screen, SearchBar, SectionTitle, Skeleton, StatCard } from '../components';
import { IconName } from '../components/Icon';
import { colors, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { fetchAllSchools, fetchPlatformStats } from '../lib/superAdmin';

type Tool = { label: string; desc: string; icon: IconName; route: string };
const GROUPS: { title: string; tools: Tool[] }[] = [
  {
    title: 'Platform',
    tools: [
      { label: 'All users', desc: 'Profiles, block or delete accounts', icon: 'users', route: 'SuperAdminUsers' },
      { label: 'Broadcasts', desc: 'Message every school at once', icon: 'megaphone', route: 'SuperAdminBroadcasts' },
      { label: 'Staff attendance', desc: 'Clock ins across all schools', icon: 'checklist', route: 'SuperAdminAttendance' },
      { label: 'App settings', desc: 'Logo, support button, feature switches', icon: 'settings', route: 'SuperAdminSettings' },
      { label: 'App version', desc: 'Push an update popup to users', icon: 'server', route: 'SuperAdminAppVersion' },
      { label: 'Terms and About', desc: 'Terms and conditions, About Scholin', icon: 'file', route: 'SuperAdminTermsAbout' },
    ],
  },
  {
    title: 'Money',
    tools: [
      { label: 'Subscriptions', desc: 'Active, on trial, expired or cancelled', icon: 'card', route: 'SuperAdminSubscriptions' },
      { label: 'Subscription pricing', desc: 'Trial length, price and discounts', icon: 'tags', route: 'SuperAdminSubPricing' },
      { label: 'School finance', desc: 'Online fees, commission, settlements', icon: 'bank', route: 'SuperAdminFinance' },
      { label: 'Referrals', desc: 'Commission rate, balances, payouts', icon: 'gift', route: 'SuperAdminReferrals' },
      { label: 'Commission ranges', desc: 'Flat commission on fee payments', icon: 'receipt', route: 'SuperAdminCommissionTiers' },
      { label: 'Payment terms', desc: 'Terms accepted before payouts', icon: 'fileCheck', route: 'SuperAdminPaymentTerms' },
    ],
  },
  {
    title: 'Vacancies',
    tools: [{ label: 'Vacancy settings', desc: 'Price per day and banner speed', icon: 'briefcase', route: 'SuperAdminVacancy' }],
  },
];

function initials(name: string) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function SuperAdminHomeScreen() {
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<{ schools: number; teachers: number; students: number } | null>(null);
  const [schools, setSchools] = useState<any[] | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const [s, list] = await Promise.all([fetchPlatformStats(), fetchAllSchools()]);
      setStats(s);
      setSchools(list);
    } catch (e: any) {
      setSchools(prev => prev || []);
      setError(e && e.message ? e.message : 'Could not load the dashboard.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const shown = (schools || []).filter(s => {
    const q = query.trim().toLowerCase();
    return !q || (s.name || '').toLowerCase().includes(q) || (s.address || '').toLowerCase().includes(q) || (s.phone || '').includes(q);
  });

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[text.h2, { color: colors.text }]}>Super Admin</Text>
            <Text style={[text.small, { color: colors.textMuted }]}>Everything across the platform</Text>
          </View>
          <Pressable onPress={() => supabase.auth.signOut()} style={styles.signOut} hitSlop={8}>
            <Icon name="logout" size={20} color={colors.danger} />
          </Pressable>
        </View>

        <Notice message={error} tone="error" />

        {stats ? (
          <View style={styles.statRow}>
            <View style={styles.statCell}>
              <StatCard label="Schools" value={String(stats.schools)} icon="school" tone="blue" />
            </View>
            <View style={styles.statCell}>
              <StatCard label="Staff" value={String(stats.teachers)} icon="users" tone="green" />
            </View>
            <View style={styles.statCell}>
              <StatCard label="Students" value={String(stats.students)} icon="cap" tone="purple" />
            </View>
          </View>
        ) : (
          <Skeleton height={110} radius={22} />
        )}

        {GROUPS.map(g => (
          <View key={g.title}>
            <SectionTitle title={g.title} />
            <View style={styles.group}>
              {g.tools.map((t, i) => (
                <Pressable key={t.route} onPress={() => navigation.navigate(t.route)} style={[styles.tool, i > 0 && styles.toolDivider]}>
                  <View style={styles.toolIcon}>
                    <Icon name={t.icon} size={19} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{t.label}</Text>
                    <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>{t.desc}</Text>
                  </View>
                  <Icon name="chevron" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <SectionTitle title="Registered schools" />
        <SearchBar value={query} onChange={setQuery} placeholder="Search schools" />
        <View style={{ gap: spacing.md, marginTop: spacing.md }}>
          {schools === null ? (
            <Skeleton height={170} radius={20} />
          ) : shown.length === 0 ? (
            <Text style={[text.body, { color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.xl }]}>
              {schools.length === 0 ? 'No schools registered yet.' : 'No school matches your search.'}
            </Text>
          ) : (
            shown.map(s => (
              <Pressable key={s.id} onPress={() => navigation.navigate('SuperAdminSchoolView', { schoolId: s.id, name: s.name })} style={styles.school}>
                <View style={styles.avatar}>
                  <Text style={[text.bodyStrong, { color: colors.primary }]}>{initials(s.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{s.name}</Text>
                  <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={1}>{s.address || 'No address'}</Text>
                  <Text style={[text.caption, { color: colors.textMuted }]}>
                    {(s.phone || 'No phone') + '  ·  Registered ' + new Date(s.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Icon name="chevron" size={18} color={colors.textMuted} />
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  signOut: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  statRow: { flexDirection: 'row', gap: spacing.md },
  statCell: { flex: 1 },
  group: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tool: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  toolDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  toolIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  school: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
