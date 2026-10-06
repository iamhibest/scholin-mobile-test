import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SchoolMark } from '../components/JobCard';
import { Avatar, BottomSheet, Button, FadeIn, Icon, InfoBanner, MoreToolsSheet, QuickTile, RoundButton, SectionTitle, SideMenu, Skeleton, StatCard, TopBar } from '../components';
import VacancyBanner from '../components/VacancyBanner';
import { MenuGroup } from '../components/SideMenu';
import { IconName } from '../components/Icon';
import { colors, fonts, radius, shadow, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { greeting, naira, shortDate } from '../lib/format';
import { loadStaffDashboard, StaffData, switchActiveSchool } from '../lib/dashboard';

const roleLabel = { owner: 'School Owner', teacher_admin: 'Teacher Admin', teacher: 'Teacher' } as const;

type Tile = { label: string; icon: IconName; tone: any; route: string; params?: any };

const adminTiles: Tile[] = [
  { label: 'School Portal', icon: 'school', tone: 'green', route: 'Feature' },
  { label: 'My Posting', icon: 'file', tone: 'blue', route: 'Feature' },
  { label: 'Announcements', icon: 'megaphone', tone: 'purple', route: 'Feature' },
  { label: 'Teachers and Roles', icon: 'userCog', tone: 'pink', route: 'Feature' },
  { label: 'Clock In and Out', icon: 'clock', tone: 'amber', route: 'Feature' },
  { label: 'Subscription', icon: 'card', tone: 'teal', route: 'Feature' },
];

const teacherTiles: Tile[] = [
  { label: 'My Classes', icon: 'cap', tone: 'blue', route: 'Feature' },
  { label: 'My Postings', icon: 'file', tone: 'green', route: 'Feature' },
  { label: 'Announcements', icon: 'megaphone', tone: 'purple', route: 'Feature' },
  { label: 'Clock In and Out', icon: 'clock', tone: 'amber', route: 'Feature' },
];

const featureRoutes: Record<string, string> = {
  'Students': 'Students',
  'Teachers and Roles': 'Teachers',
  'School Portal': 'Portal',
  'Clock In and Out': 'Clock',
  'My Classes': 'MyClasses',
  'Subjects': 'Subjects',
  'Class Subjects': 'ClassSubjects',
  'Student Promotion': 'Promotion',
  'Student Migration': 'Migration',
  'Report Card Templates': 'ReportTemplates',
  'Staff Attendance': 'StaffAttendance',
  'Student Attendance': 'StudentAttendance',
  'Attendance QR Codes': 'QrCodes',
  'Sessions and Terms': 'SessionsTerms',
  'Auto Comments': 'AutoComments',
  'Archived Sessions': 'ArchivedSessions',
  'School Settings': 'SchoolSettings',
  'Subscription': 'Subscription',
  'Events and Fees': 'Events',
  'My Profile': 'MyProfile',
  'Recent Activity': 'ActivityLog',
  'School Overview': 'SchoolOverview',
  'Results Status': 'ResultsStatus',
  'Refer and Earn': 'Referral',
  'My Schools': 'MySchools',
  'Job Vacancies': 'Vacancies',
  'My Postings': 'MyVacancies',
  'My Posting': 'MyVacancies',
};

export default function StaffHomeScreen({ navigation }: any) {
  const [data, setData] = useState<StaffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [tools, setTools] = useState(false);
  const [news, setNews] = useState(false);
  const userId = useRef('');

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }
      userId.current = user.id;
      const result = await loadStaffDashboard(user.id);
      if (result === 'superadmin') {
        navigation.reset({ index: 0, routes: [{ name: 'SuperAdminHome' }] });
        return;
      }
      if (result === 'onboarding') {
        navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
        return;
      }
      setData(result);
      setVacancyIndex(0);
    } catch (e: any) {
      logger.error('Dashboard failed: ' + e.message);
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigation]);

  useEffect(() => {
    load();
  }, [load]);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      load();
    }, [load]),
  );

  async function signOut() {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  async function switchSchool(schoolId: string) {
    setLoading(true);
    await switchActiveSchool(userId.current, schoolId);
    await load();
  }

  const go = (title: string) => {
    let route = featureRoutes[title];
    if (title === 'Announcements') {
      route = data && data.isAdmin ? 'AdminAnnouncements' : 'Announcements';
    }
    if (route) {
      navigation.navigate(route);
    } else {
      navigation.navigate('Feature', { title });
    }
  };

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.root}>
        <TopBar />
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <Skeleton height={120} radius={24} />
          <Skeleton height={190} radius={24} />
          <Skeleton height={80} radius={24} />
          {failed ? (
            <View style={{ alignItems: 'center', gap: spacing.md }}>
              <Text style={[text.body, { color: colors.textMuted }]}>Could not load your dashboard.</Text>
              <Button title="Try again" variant="soft" onPress={() => { setLoading(true); load(); }} />
              <Button title="Sign out" variant="ghost" onPress={signOut} />
            </View>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const { school, role, isAdmin, access } = data;
  const initial = (data.profile.full_name || '?').trim().charAt(0).toUpperCase();

  const groups: MenuGroup[] = [
    {
      title: 'Navigation',
      items: [
        { label: 'Dashboard', icon: 'dashboard', active: true, onPress: () => {} },
        { label: 'School Overview', icon: 'building', onPress: () => go('School Overview') },
        { label: 'School Portal', icon: 'school', hidden: !access.active, onPress: () => go('School Portal') },
        { label: 'Clock In and Out', icon: 'clock', hidden: !access.active, onPress: () => go('Clock In and Out') },
        { label: 'Refer and Earn', icon: 'gift', onPress: () => go('Refer and Earn') },
        { label: 'Job Vacancies', icon: 'briefcase', onPress: () => go('Job Vacancies') },
        { label: 'My Postings', icon: 'file', onPress: () => go('My Postings') },
        { label: 'Subscription', icon: 'card', hidden: !isAdmin, onPress: () => go('Subscription') },
        { label: 'My Profile', icon: 'user', onPress: () => navigation.navigate('MyProfile') },
        { label: 'My Schools', icon: 'school', onPress: () => navigation.navigate('MySchools') },
        { label: 'Terms and About', icon: 'info', onPress: () => navigation.navigate('Terms') },
        { label: 'Developer tools', icon: 'bug', onPress: () => navigation.navigate('Developer') },
      ],
    },
    {
      title: 'Administration',
      items: [
        { label: 'Teachers and Roles', icon: 'userCog', hidden: !isAdmin, onPress: () => go('Teachers and Roles') },
        { label: 'Announcements', icon: 'megaphone', onPress: () => go('Announcements') },
        { label: 'More Admin Tools', icon: 'grid', hidden: !(isAdmin && access.active), onPress: () => setTools(true) },
      ],
    },
  ];

  const schoolHeader = (
    <View style={styles.schools}>
      <View style={styles.menuSchool}>
        <SchoolMark name={school.name} uri={school.logo_url} size={52} />
        <View style={{ flex: 1 }}>
          <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={2}>{school.name}</Text>
          <Text style={[text.small, { color: colors.textMuted }]}>{roleLabel[role]}</Text>
        </View>
      </View>
      <Text style={[text.caption, { color: colors.textMuted, letterSpacing: 1 }]}>MY SCHOOLS</Text>
      {data.allMemberships.map((m: any) => {
        const current = m.school_id === school.id;
        return (
          <Pressable key={m.school_id} disabled={current} onPress={() => { setMenu(false); setTimeout(() => switchSchool(m.school_id), 260); }} style={[styles.schoolRow, current && { backgroundColor: colors.primarySoft }]}>
            <Icon name="school" size={18} color={current ? colors.primary : colors.textMuted} />
            <Text style={[text.bodyStrong, { color: current ? colors.primary : colors.text, flex: 1 }]} numberOfLines={1}>{m.schools ? m.schools.name : 'School'}</Text>
            {current ? <Text style={[text.caption, { color: colors.primary }]}>Current</Text> : null}
          </Pressable>
        );
      })}
      <Pressable onPress={() => { setMenu(false); setTimeout(() => navigation.navigate('JoinAnotherSchool'), 260); }} style={styles.schoolRow}>
        <Icon name="plus" size={18} color={colors.success} />
        <Text style={[text.bodyStrong, { color: colors.success }]}>Join another school</Text>
      </Pressable>
    </View>
  );

  let banner: { text: string; tone: 'trial' | 'bad' } | null = null;
  if (isAdmin) {
    if (access.reason === 'cancelled') {
      banner = { text: 'Your subscription was cancelled by Scholin support. Contact support or start a new subscription.', tone: 'bad' };
    } else if (access.reason === 'trial') {
      const days = Math.max(0, Math.ceil((new Date(access.trialEndsAt as string).getTime() - Date.now()) / 86400000));
      banner = { text: 'Free trial: ' + days + ' day' + (days === 1 ? '' : 's') + ' left.', tone: 'trial' };
    } else if (access.reason === 'expired') {
      banner = { text: 'Your free trial has ended. Subscribe now to restore full access.', tone: 'bad' };
    } else if (access.reason === 'subscribed') {
      const days = Math.ceil((new Date(access.subscriptionEndsAt as string).getTime() - Date.now()) / 86400000);
      if (days <= 30) {
        banner = { text: 'Your subscription ends in ' + Math.max(0, days) + ' day' + (days === 1 ? '' : 's') + ' (' + shortDate(access.subscriptionEndsAt as string) + '). Renew now to avoid losing access.', tone: 'trial' };
      }
    }
  }

  const tiles = isAdmin ? adminTiles : teacherTiles;
  const attend = data.attendance;
  const results = data.results;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <TopBar
        onMenu={() => setMenu(true)}
        right={<RoundButton icon="bell" badge={data.unread} onPress={() => { setData({ ...data, unread: 0 }); go('Recent Activity'); }} />}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[colors.primary]} />}>
        <FadeIn>
          <View style={[styles.hero, shadow.soft]}>
            <View style={{ flex: 1 }}>
              <Text style={[text.body, { color: colors.textMuted }]}>{greeting()}</Text>
              <Text style={styles.name} numberOfLines={2}>{data.profile.full_name}</Text>
              <Text style={[text.body, { color: colors.textMuted }]} numberOfLines={2}>{school.name + ' \u2022 ' + roleLabel[role]}</Text>
            </View>
            <Pressable onPress={() => navigation.navigate('MyProfile')} hitSlop={8}>
              <View style={styles.avatar}>
                <Avatar name={data.profile.full_name} uri={data.profile.avatar_url || undefined} size={58} />
              </View>
              <View style={styles.dot} />
            </Pressable>
          </View>
        </FadeIn>

        {banner ? (
          <View style={[styles.sub, banner.tone === 'bad' ? { backgroundColor: colors.dangerSoft } : { backgroundColor: colors.accentSoft }]}>
            <Icon name="info" size={18} color={banner.tone === 'bad' ? colors.danger : colors.accentDark} />
            <Text style={[text.small, { flex: 1, color: banner.tone === 'bad' ? colors.danger : colors.accentDark }]}>{banner.text}</Text>
          </View>
        ) : null}

        <FadeIn delay={80} style={{ marginTop: spacing.lg }}>
          {data.layout === 'adminFees' ? (
            <View style={styles.statRow}>
              <StatCard
                style={{ flex: 1 }}
                size="hero"
                tone="amber"
                icon="card"
                label="Fees Due"
                value={naira(data.fees?.owed || 0)}
                valueColor={(data.fees?.owed || 0) > 0 ? colors.danger : colors.text}
                sub="Outstanding"
                cta="View details"
                onPress={() => go('Events and Fees')}
              />
              <View style={{ flex: 1, gap: spacing.md }}>
                <StatCard tone="green" icon="users" label="Students" value={String(data.students?.count || 0)} sub="Total" trend={data.students?.trend} onPress={() => go('Students')} />
                <StatCard tone="purple" icon="userCog" label="Teachers" value={String(data.teachers?.count || 0)} sub="Active" trend={data.teachers?.trend} onPress={() => go('Teachers and Roles')} />
              </View>
            </View>
          ) : data.layout === 'adminGrid' ? (
            <View style={styles.grid}>
              <StatCard style={styles.half} tone="green" icon="users" label="Students" value={String(data.students?.count || 0)} sub="Total" trend={data.students?.trend} onPress={() => go('Students')} />
              <StatCard style={styles.half} tone="purple" icon="userCog" label="Teachers" value={String(data.teachers?.count || 0)} sub="Active" trend={data.teachers?.trend} onPress={() => go('Teachers and Roles')} />
              <StatCard style={styles.half} tone="blue" icon="file" label="Results" value={results?.value || '-'} sub={results?.sub} valueColor={results?.good ? colors.success : results?.warn ? colors.danger : colors.text} onPress={() => go('Results Status')} />
              <StatCard style={styles.half} tone="purple" icon="calendar" label="Attendance" value={attend?.value || '-'} sub={attend?.sub} valueColor={attend?.warn ? colors.danger : attend?.good ? colors.success : colors.text} subColor={attend?.warn ? colors.danger : undefined} onPress={() => go('Attendance History')} />
            </View>
          ) : (
            <View style={styles.statRow}>
              <StatCard
                style={{ flex: 1 }}
                size="hero"
                tone="blue"
                icon="file"
                label="Results"
                value={results?.value || '-'}
                valueColor={results?.good ? colors.success : results?.warn ? colors.danger : colors.text}
                sub={results?.sub}
                cta="View details"
                onPress={() => go('Results Status')}
              />
              <View style={{ flex: 1, gap: spacing.md }}>
                <StatCard tone="green" icon="cap" label="My Classes" value={String(data.classCount || 0)} sub="Total" onPress={() => go('My Classes')} />
                <StatCard tone="purple" icon="calendar" label="Attendance" value={attend?.value || '-'} sub={attend?.sub} valueColor={attend?.warn ? colors.danger : attend?.good ? colors.success : colors.text} subColor={attend?.warn ? colors.danger : undefined} onPress={() => go('Attendance History')} />
              </View>
            </View>
          )}
        </FadeIn>

        {data.announcement ? (
          <InfoBanner tag="Scholin" icon="megaphone" title={data.announcement.title ? data.announcement.title + '.' : ''} body={data.announcement.body} onPress={() => setNews(true)} />
        ) : null}

        {data.vacancies.length ? <VacancyBanner items={data.vacancies} seconds={data.rotation} onPress={() => go('Job Vacancies')} /> : null}

        <SectionTitle title="Quick Access" action={isAdmin && access.active ? 'More tools' : undefined} onAction={() => setTools(true)} />
        <View style={styles.tiles}>
          {tiles.map((t, i) => (
            <FadeIn key={t.label} delay={120 + i * 50} style={{ width: '31%' }}>
              <QuickTile width="100%" label={t.label} icon={t.icon} tone={t.tone} onPress={() => go(t.label)} />
            </FadeIn>
          ))}
        </View>
      </ScrollView>

      <SideMenu visible={menu} onClose={() => setMenu(false)} groups={groups} header={schoolHeader} footer={{ label: 'Sign out', icon: 'logout', onPress: signOut }} />

      <MoreToolsSheet visible={tools} onClose={() => setTools(false)} onSelect={label => { setTools(false); setTimeout(() => go(label), 280); }} />

      <BottomSheet visible={news} onClose={() => setNews(false)} title={data.announcement?.title || 'Announcement'}>
        <ScrollView style={{ maxHeight: 360 }}>
          <Text style={[text.body, { color: colors.text }]}>{data.announcement?.body}</Text>
        </ScrollView>
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  menuSchool: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl },
  name: { fontFamily: fonts.headingBold, fontSize: 26, lineHeight: 34, color: colors.text, marginVertical: 2 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.surface },
  initial: { fontFamily: fonts.headingBold, fontSize: 26, color: colors.primary },
  dot: { position: 'absolute', right: 2, bottom: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#3CB371', borderWidth: 2, borderColor: colors.surface },
  sub: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.md },
  statRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  half: { width: '48%', flexGrow: 1 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  schools: { marginTop: spacing.lg, gap: 4 },
  schoolRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 11, paddingHorizontal: spacing.md, borderRadius: radius.md },
});
