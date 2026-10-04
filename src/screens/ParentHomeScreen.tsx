import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Badge, BottomSheet, BottomTabs, Button, Card, EmptyState, FadeIn, Icon, Input, ListRow, Notice, RoundButton, SectionTitle, Skeleton, StatCard, TopBar } from '../components';
import { IconName } from '../components/Icon';
import { colors, fonts, radius, shadow, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { naira, ordinal, shortDate } from '../lib/format';
import { Child, ChildOverview, FeeRow, linkChildByCode, loadChildOverview, loadChildren, loadParentProfile, loadSessions, ReportRow, Session } from '../lib/parent';

const feeIcons: Record<string, IconName> = {
  school_fees: 'card', examination: 'file', excursion: 'pin', graduation: 'cap', party: 'gift',
  pta: 'users', sports: 'trend', books: 'book', uniform: 'tags', other: 'receipt',
};

const tabs = [
  { key: 'home', label: 'Home', icon: 'dashboard' as IconName },
  { key: 'reports', label: 'Reports', icon: 'file' as IconName },
  { key: 'fees', label: 'Fees', icon: 'card' as IconName },
  { key: 'events', label: 'Events', icon: 'calendar' as IconName },
  { key: 'profile', label: 'Profile', icon: 'user' as IconName },
];

function ChildPhoto({ child, size }: { child?: Child; size: number }) {
  if (child && child.photo_url) {
    return <Image source={{ uri: child.photo_url }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="user" size={size * 0.5} color={colors.primary} />
    </View>
  );
}

function Row({ icon, title, sub, right, onPress, label }: { icon: IconName; title: string; sub?: string; right?: React.ReactNode; onPress?: () => void; label?: string }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, shadow.soft, pressed && { opacity: 0.92 }]}>
      <View style={styles.rowIcon}>{label ? <Text style={styles.rowLabel}>{label}</Text> : <Icon name={icon} size={20} color={colors.primary} />}</View>
      <View style={{ flex: 1 }}>
        <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={2}>{title}</Text>
        {sub ? <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={2}>{sub}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

function feeBadge(f: FeeRow) {
  if (f.owed <= 0) {
    return <Badge label="Paid" tone="green" />;
  }
  return <Badge label={f.paid > 0 ? 'Partial' : 'Pending'} tone={f.paid > 0 ? 'blue' : 'orange'} />;
}

export default function ParentHomeScreen({ navigation }: any) {
  const [tab, setTab] = useState('home');
  const [profile, setProfile] = useState({ name: '', email: '', phone: '' });
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState('');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [overview, setOverview] = useState<ChildOverview | null>(null);
  const [booting, setBooting] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pickSession, setPickSession] = useState(false);
  const [addChild, setAddChild] = useState(false);
  const [code, setCode] = useState('');
  const [addMsg, setAddMsg] = useState('');
  const [adding, setAdding] = useState(false);
  const [userId, setUserId] = useState('');

  const child = children.find(c => c.id === childId);
  const session = sessions.find(s => s.id === sessionId);

  const loadOverview = useCallback(async (c: Child, sid: string | null) => {
    setBusy(true);
    try {
      setOverview(await loadChildOverview(c, sid));
    } catch (e: any) {
      logger.error('Parent overview failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const selectChild = useCallback(
    async (c: Child) => {
      setChildId(c.id);
      setOverview(null);
      const list = await loadSessions(c.school_id);
      setSessions(list);
      const current = list.find(s => s.is_current) || list[0];
      const sid = current ? current.id : null;
      setSessionId(sid);
      await loadOverview(c, sid);
    },
    [loadOverview],
  );

  const boot = useCallback(
    async (keepChild?: string) => {
      setFailed(false);
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user) {
          navigation.reset({ index: 0, routes: [{ name: 'ParentLogin' }] });
          return;
        }
        setUserId(user.id);
        const [p, list] = await Promise.all([loadParentProfile(user.id), loadChildren(user.id)]);
        setProfile(p);
        setChildren(list);
        if (list.length > 0) {
          await selectChild(list.find(c => c.id === keepChild) || list[0]);
        }
      } catch (e: any) {
        logger.error('Parent load failed: ' + e.message);
        setFailed(true);
      } finally {
        setBooting(false);
        setRefreshing(false);
      }
    },
    [navigation, selectChild],
  );

  useEffect(() => {
    boot();
  }, [boot]);

  async function signOut() {
    await supabase.auth.signOut();
    navigation.reset({ index: 0, routes: [{ name: 'ParentLogin' }] });
  }

  async function submitCode() {
    const value = code.trim().toUpperCase();
    setAddMsg('');
    if (!value) {
      setAddMsg("Please enter your child's invite code.");
      return;
    }
    setAdding(true);
    try {
      const problem = await linkChildByCode(userId, value, children);
      if (problem) {
        setAddMsg(problem);
        return;
      }
      setAddChild(false);
      setCode('');
      await boot(childId);
    } catch (e: any) {
      setAddMsg('Something went wrong. Please check your connection and try again.');
    } finally {
      setAdding(false);
    }
  }

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (child) {
        loadOverview(child, sessionId);
      }
    }, [child, sessionId, loadOverview]),
  );

  const soon = (title: string) => navigation.navigate('Feature', { title });

  function ReportRows({ items }: { items: ReportRow[] }) {
    if (items.length === 0) {
      return <Row icon="file" title="No report card available yet." />;
    }
    return (
      <View style={{ gap: spacing.md }}>
        {items.map((r, i) => {
          const badge = r.state === 'available' ? <Badge label="Available" tone="green" /> : r.state === 'locked' ? <Badge label="Outstanding fees" tone="red" /> : <Badge label="Pending" tone="blue" />;
          const sub =
            r.state === 'available'
              ? r.publishedAt ? 'Published on ' + shortDate(r.publishedAt) : 'Published'
              : r.state === 'locked'
              ? 'Results are ready. Outstanding: ' + r.outstanding.map(o => o.name + ' (' + naira(o.balance) + ')').join(', ')
              : 'Not published yet';
          return <Row key={r.termId} icon="file" label={ordinal(i)} title={r.termName + ' Report Card'} sub={sub} right={badge} onPress={r.state === 'available' && child ? () => navigation.navigate('ParentReportCard', { studentId: child.id, studentName: child.full_name, schoolId: child.school_id, classId: r.classId, termId: r.termId, sessionId: r.sessionId, sessionName: (sessions.find(x => x.id === r.sessionId) || { name: '' }).name, termName: r.termName }) : undefined} />;
        })}
      </View>
    );
  }

  function FeeRows({ items }: { items: FeeRow[] }) {
    if (items.length === 0) {
      return <Row icon="receipt" title="No fees or events assigned yet." />;
    }
    return (
      <View style={{ gap: spacing.md }}>
        {items.map(f => (
          <Row
            key={f.id}
            icon={feeIcons[f.type] || 'receipt'}
            title={f.name}
            sub={f.dueDate ? 'Due ' + shortDate(f.dueDate) : 'No due date set'}
            onPress={() => child && navigation.navigate('ParentFeeDetail', { eventId: f.eventId, studentId: child.id, studentName: child.full_name, schoolId: child.school_id })}
            right={
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[text.bodyStrong, { color: f.owed > 0 ? colors.danger : colors.success }]}>{naira(f.due)}</Text>
                {feeBadge(f)}
              </View>
            }
          />
        ))}
      </View>
    );
  }

  function EventRows() {
    const list = overview?.events || [];
    if (list.length === 0) {
      return <Row icon="calendar" title="No upcoming events." />;
    }
    return (
      <View style={{ gap: spacing.md }}>
        {list.map(e => (
          <Row key={e.id} icon={feeIcons[e.type] || 'calendar'} title={e.name} sub={shortDate(e.dueDate)} right={<Badge label="Upcoming" tone="purple" />} />
        ))}
      </View>
    );
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.root}>
        <TopBar />
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <Skeleton height={180} radius={24} />
          <Skeleton height={110} radius={24} />
          <Skeleton height={70} radius={20} />
        </View>
      </SafeAreaView>
    );
  }

  if (failed) {
    return (
      <SafeAreaView style={styles.root}>
        <TopBar />
        <EmptyState icon="info" title="Could not load your children" message="Check your connection and try again." actionLabel="Try again" onAction={() => { setBooting(true); boot(); }} />
        <Button title="Sign out" variant="ghost" onPress={signOut} />
      </SafeAreaView>
    );
  }

  const addChildSheet = (
    <BottomSheet visible={addChild} onClose={() => setAddChild(false)} title="Add another child">
      <Text style={[text.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>Enter the invite code your child's school gave you. Each child has their own independent code.</Text>
      <Notice message={addMsg} />
      <Input label="Child's invite code" value={code} onChangeText={v => setCode(v.toUpperCase())} maxLength={6} autoCapitalize="characters" placeholder="e.g. A3F7K9" />
      <Button title="Link child" onPress={submitCode} loading={adding} />
    </BottomSheet>
  );

  const body = (() => {
    if (children.length === 0) {
      return (
        <View>
          <EmptyState icon="userPlus" title="You have not linked a child yet" message="Use the invite code from your child's school to link your account." actionLabel="Add a child with an invite code" onAction={() => setAddChild(true)} />
        </View>
      );
    }
    if (tab === 'profile') {
      return (
        <View>
          <Card style={{ alignItems: 'center' }}>
            <View style={styles.bigAvatar}>
              <Text style={styles.bigInitial}>{profile.name.replace(/^(Mr|Mrs|Miss|Ms|Dr|Prof|Engr|Chief|Alhaji|Alhaja|Rev|Pastor)\s+/, '').charAt(0).toUpperCase()}</Text>
            </View>
            <Text style={[text.h2, { color: colors.text, marginTop: spacing.md, textAlign: 'center' }]}>{profile.name}</Text>
            {profile.email ? <Text style={[text.small, { color: colors.textMuted }]}>{profile.email}</Text> : null}
            {profile.phone ? <Text style={[text.small, { color: colors.textMuted }]}>{profile.phone}</Text> : null}
          </Card>
          <SectionTitle title="My children" />
          <Card>
            {children.map(c => (
              <ListRow key={c.id} title={c.full_name} subtitle={c.school_name} icon="user" onPress={() => { setTab('home'); selectChild(c); }} />
            ))}
          </Card>
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            <Button title="Add another child" variant="soft" icon="plus" onPress={() => setAddChild(true)} />
            <Button title="Terms and About" variant="outline" onPress={() => navigation.navigate('Terms')} />
            <Button title="Developer tools" variant="ghost" onPress={() => navigation.navigate('Developer')} />
            <Button title="Sign out" variant="danger" icon="logout" onPress={signOut} />
          </View>
        </View>
      );
    }
    if (!overview) {
      return (
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          <Skeleton height={110} radius={24} />
          <Skeleton height={70} radius={20} />
          <Skeleton height={70} radius={20} />
        </View>
      );
    }
    if (tab === 'reports') {
      return (
        <View>
          <SectionTitle title="Report Cards" subtitle="View and download report cards for this session." />
          <ReportRows items={overview.reports} />
        </View>
      );
    }
    if (tab === 'fees') {
      const expected = overview.fees.reduce((s, f) => s + f.due, 0);
      const paid = overview.fees.reduce((s, f) => s + f.paid, 0);
      return (
        <View>
          <View style={styles.summary}>
            <View style={{ flex: 1 }}>
              <Text style={[text.caption, { color: colors.textMuted }]}>EXPECTED</Text>
              <Text style={styles.sumValue}>{naira(expected)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[text.caption, { color: colors.textMuted }]}>PAID</Text>
              <Text style={[styles.sumValue, { color: colors.success }]}>{naira(paid)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[text.caption, { color: colors.textMuted }]}>OUTSTANDING</Text>
              <Text style={[styles.sumValue, { color: overview.owed > 0 ? colors.danger : colors.text }]}>{naira(overview.owed)}</Text>
            </View>
          </View>
          <SectionTitle title="Fees and Payments" subtitle="Track all fees and payments for this session." />
          <FeeRows items={overview.fees} />
        </View>
      );
    }
    if (tab === 'events') {
      return (
        <View>
          <SectionTitle title="Events" subtitle="Stay up to date with school events." />
          <EventRows />
        </View>
      );
    }
    return (
      <View>
        <Text style={[text.caption, { color: colors.textMuted, marginTop: spacing.lg, letterSpacing: 0.6 }]}>SELECTED SESSION OVERVIEW</Text>
        <View style={styles.overview}>
          <StatCard style={{ flex: 1 }} tone="green" icon="file" label="Reports" value={String(overview.availableReports)} sub="Available" onPress={() => setTab('reports')} />
          <StatCard style={{ flex: 1 }} tone="amber" icon="card" label="Fees Due" value={naira(overview.owed)} valueColor={overview.owed > 0 ? colors.danger : colors.text} sub="Outstanding" onPress={() => setTab('fees')} />
          <StatCard style={{ flex: 1 }} tone="purple" icon="calendar" label="Events" value={String(overview.events.length)} sub="Upcoming" onPress={() => setTab('events')} />
        </View>
        <SectionTitle title="Report Cards" action="View all" onAction={() => setTab('reports')} />
        <ReportRows items={overview.reports.slice(0, 3)} />
        <SectionTitle title="Fees and Payments" action="View all" onAction={() => setTab('fees')} />
        <FeeRows items={overview.fees.slice(0, 3)} />
        <SectionTitle title="Events" action="View all" onAction={() => setTab('events')} />
        <EventRows />
        <SectionTitle title="Announcements" />
        {overview.news.length === 0 ? (
          <Row icon="megaphone" title="No announcements yet." />
        ) : (
          <View style={{ gap: spacing.md }}>
            {overview.news.map(n => (
              <Card key={n.id}>
                <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  {n.broadcast ? <Badge label="Scholin" tone="blue" /> : <Badge label="School" tone="green" />}
                  <Text style={[text.caption, { color: colors.textMuted }]}>{shortDate(n.created_at)}</Text>
                </View>
                <Text style={[text.bodyStrong, { color: colors.text, marginTop: spacing.sm }]}>{n.title}</Text>
                <Text style={[text.body, { color: colors.textMuted }]} numberOfLines={3}>{n.body}</Text>
              </Card>
            ))}
          </View>
        )}
      </View>
    );
  })();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <TopBar right={<RoundButton icon="info" onPress={() => navigation.navigate('Terms')} />} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); boot(childId); }} colors={[colors.primary]} />}>
        {tab !== 'profile' ? (
          <FadeIn>
            <View style={[styles.welcome, shadow.raised]}>
              <View style={styles.welcomeTop}>
                <View style={styles.welcomeAvatar}>
                  <ChildPhoto child={child} size={56} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[text.small, { color: 'rgba(255,255,255,0.8)' }]}>Welcome back,</Text>
                  <Text style={styles.welcomeName} numberOfLines={2}>{profile.name}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}><Icon name="user" size={18} color="#FFFFFF" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[text.caption, { color: 'rgba(255,255,255,0.75)' }]}>{children.length > 1 ? 'Viewing' : 'Your Child'}</Text>
                  <Text style={[text.bodyStrong, { color: '#FFFFFF' }]} numberOfLines={1}>{child ? child.full_name : 'None linked yet'}</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}><Icon name="school" size={18} color="#FFFFFF" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[text.caption, { color: 'rgba(255,255,255,0.75)' }]}>School</Text>
                  <Text style={[text.bodyStrong, { color: '#FFFFFF' }]} numberOfLines={1}>{child ? child.school_name : '-'}</Text>
                </View>
              </View>
            </View>
          </FadeIn>
        ) : null}

        {tab !== 'profile' && children.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.lg }} contentContainerStyle={{ gap: spacing.sm }}>
            {children.map(c => {
              const on = c.id === childId;
              return (
                <Pressable key={c.id} onPress={() => selectChild(c)} style={[styles.chip, on && styles.chipOn]}>
                  <ChildPhoto child={c} size={26} />
                  <Text style={[text.bodyStrong, { color: on ? '#FFFFFF' : colors.text }]}>{c.full_name.split(' ')[0]}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setAddChild(true)} style={[styles.chip, { borderStyle: 'dashed' }]}>
              <Icon name="plus" size={16} color={colors.primary} />
              <Text style={[text.bodyStrong, { color: colors.primary }]}>Add</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {tab !== 'profile' && sessions.length > 0 ? (
          <Pressable onPress={() => setPickSession(true)} style={[styles.session, shadow.soft]}>
            <View style={{ flex: 1 }}>
              <Text style={[text.caption, { color: colors.textMuted }]}>ACTIVE SESSION</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={[text.h3, { color: colors.text }]}>{session ? session.name : 'Select a session'}</Text>
                {session && session.is_current ? <Badge label="Current" tone="green" /> : null}
              </View>
            </View>
            <Icon name="chevronDown" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}

        {busy && overview ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} /> : null}
        {body}
      </ScrollView>

      <BottomTabs tabs={tabs} active={tab} onChange={setTab} />

      <BottomSheet visible={pickSession} onClose={() => setPickSession(false)} title="Select a session">
        <ScrollView style={{ maxHeight: 360 }}>
          {sessions.map(s => (
            <ListRow
              key={s.id}
              title={s.name + (s.is_current ? ' (Current)' : '')}
              onPress={() => {
                setPickSession(false);
                setSessionId(s.id);
                if (child) {
                  loadOverview(child, s.id);
                }
              }}
            />
          ))}
        </ScrollView>
      </BottomSheet>

      {addChildSheet}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl },
  welcome: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl },
  welcomeTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  welcomeAvatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  welcomeName: { fontFamily: fonts.headingBold, fontSize: 24, lineHeight: 30, color: '#FFFFFF' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.md, padding: spacing.md, marginTop: spacing.sm },
  infoIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.primarySoft },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  session: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.lg },
  overview: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md },
  rowIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.primary },
  summary: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.lg },
  sumValue: { fontFamily: fonts.headingBold, fontSize: 17, color: colors.text, marginTop: 2 },
  bigAvatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  bigInitial: { fontFamily: fonts.headingBold, fontSize: 34, color: colors.primary },
  detail: { flexDirection: 'row', justifyContent: 'space-between' },
});
