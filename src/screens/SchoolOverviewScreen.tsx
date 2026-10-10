import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useNavigation } from '@react-navigation/native';
import { BottomSheet, Button, EmptyState, FilterChips, Icon, OptionField, Screen, Skeleton } from '../components';
import { IconName } from '../components/Icon';
import {
  AMBER, BadgeGrid, BarRow, Callout, Columns, DotRow, Donut, GREEN, Highlights, ListRow, Muted, Pill, RED, Ring, RingList, SectionCard, tierColor,
} from '../components/OverviewParts';
import { colors, radius, spacing, text } from '../theme';
import { getSchoolAccessStatus } from '../lib/dashboard';
import { supabase } from '../lib/supabase';
import { useStaff } from '../lib/useStaff';
import { fetchAttendanceBars, fetchSessionOptions, fetchTermOptions, Item, loadOverview, money, OverviewData, PRIORITY_ORDER } from '../lib/overview';

type Opt = { id: string; name: string; is_current: boolean };
type Sheet = { title: string; sub?: string; body: React.ReactNode } | null;

const PRIORITY_STYLE: Record<string, { fg: string; bg: string }> = {
  critical: { fg: '#8C1D14', bg: '#F5C6C6' },
  high: { fg: RED, bg: '#FCE8E6' },
  moderate: { fg: '#B26A00', bg: '#FEF3E7' },
  low: { fg: colors.primary, bg: colors.primarySoft },
};
const STATUS_STYLE: Record<string, { fg: string; bg: string }> = {
  new: { fg: RED, bg: '#FCE8E6' },
  monitoring: { fg: '#B26A00', bg: '#FEF3E7' },
  improving: { fg: GREEN, bg: '#E5F1E9' },
  resolved: { fg: colors.textMuted, bg: '#EEF1F4' },
};
const CATEGORY_LABEL: Record<string, string> = {
  attendance: 'Repeated absence', staff: 'Staff punctuality', academic: 'Academic performance', register: 'Incomplete registers', finance: 'Outstanding fees',
};
const PERIODS = [
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'term', label: 'This term' },
  { key: 'session', label: 'This session' },
];
const HIST = [
  { key: '', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'monitoring', label: 'Monitoring' },
  { key: 'improving', label: 'Improving' },
  { key: 'resolved', label: 'Resolved' },
];
const BAND_COLORS = ['#1857D6', '#4B7EE8', '#3B82C4', '#E8823C', '#D42A1F', '#8B5A9F'];

function timeShort(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) {
    return 'now';
  }
  if (mins < 60) {
    return mins + 'm';
  }
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? hrs + 'h' : Math.floor(hrs / 24) + 'd';
}

function insightLabel(row: any) {
  switch (row.category) {
    case 'attendance': return { title: 'Student with repeated absences', sub: (row.current_value ?? '') + ' absences this week' };
    case 'staff': return { title: 'Staff member with repeated lateness', sub: (row.current_value ?? '') + ' late clock ins this month' };
    case 'academic': return { title: 'Declining subject average', sub: row.previous_value != null ? row.previous_value + '% to ' + row.current_value + '%' : row.current_value + '% average' };
    case 'register': return { title: 'Class register incomplete', sub: 'Not recorded in the last 2 days' };
    case 'finance': return { title: 'Fee collection below target', sub: (row.current_value ?? '') + '% collected, 90% target' };
    default: return { title: String(row.insight_key || 'Insight'), sub: '' };
  }
}
function insightPriority(r: any) {
  if (r.category === 'finance' || r.category === 'attendance') {
    return r.status === 'monitoring' ? 'high' : 'moderate';
  }
  return r.category === 'academic' || r.category === 'register' ? 'moderate' : 'low';
}

function detailBody(item: Item) {
  const d = item.detailData;
  if (item.type === 'attendance_repeated_absence') {
    return (d || []).map((s: any, i: number) => <ListRow key={i} name={s.name} meta={s.class_name || ''} figure={(s.absence_count ?? '') + ' absences'} />);
  }
  if (item.type === 'staff_late_clockins') {
    return (d || []).map((s: any, i: number) => <ListRow key={i} name={s.name} meta={s.role || ''} figure={(s.late_count ?? '') + ' times late'} />);
  }
  if (item.type === 'academic_low_subject') {
    return [
      <ListRow key="a" name={d.name || ''} meta={(d.student_count ?? 0) + ' students assessed'} figure={d.avg_score + '%'} />,
      d.prev_avg !== null && d.prev_avg !== undefined ? <ListRow key="b" name="Previous term average" figure={d.prev_avg + '%'} figureColor={colors.textMuted} /> : null,
    ];
  }
  if (item.type === 'register_incomplete') {
    return [
      <ListRow key="a" name="Classes not recorded recently" figure={String(d.classes_not_recorded_recently ?? 0)} />,
      <ListRow key="b" name="Overall completion this term" figure={d.completion_rate + '%'} figureColor={colors.primary} />,
      <ListRow key="c" name="Expected class days" figure={String(d.expected_total ?? '')} figureColor={colors.textMuted} />,
    ];
  }
  if (item.type === 'finance_outstanding_fees') {
    return [
      <ListRow key="a" name="Collected so far" figure={money(d.collected)} figureColor={GREEN} />,
      <ListRow key="b" name="Expected" figure={money(d.expected)} figureColor={colors.textMuted} />,
      <ListRow key="c" name="Outstanding" figure={money(d.outstanding)} />,
    ];
  }
  return null;
}

export default function SchoolOverviewScreen() {
  const navigation = useNavigation<any>();
  const { ctx, loading: ctxLoading } = useStaff();
  const [name, setName] = useState('');
  const [sessions, setSessions] = useState<Opt[]>([]);
  const [terms, setTerms] = useState<Opt[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [termId, setTermId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [classFilter, setClassFilter] = useState('all');
  const [period, setPeriod] = useState('term');
  const [bars, setBars] = useState<{ label: string; rate: number }[] | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [tile, setTile] = useState('');
  const [hist, setHist] = useState('');
  const ticket = useRef(0);

  const isAdmin = ctx ? ctx.isAdmin : false;
  const canSeeFees = ctx ? ctx.role === 'owner' || ctx.membership.can_manage_events_fees !== false : true;
  const active = ctx ? getSchoolAccessStatus(ctx.school).active : true;

  // Sessions and terms: start on the current ones, like the web page.
  useEffect(() => {
    if (!ctx || !active) {
      return;
    }
    let alive = true;
    (async () => {
      try {
        const { data: p } = await supabase.from('profiles').select('full_name').eq('id', ctx.userId).maybeSingle();
        if (alive && p) {
          setName((p as any).full_name || '');
        }
        const list = await fetchSessionOptions(ctx.schoolId);
        if (!alive) {
          return;
        }
        setSessions(list);
        if (list.length) {
          const def = list.find(s => s.is_current) || list[0];
          const t = await fetchTermOptions(def.id);
          if (!alive) {
            return;
          }
          setTerms(t);
          setSessionId(def.id);
          setTermId((t.find(x => x.is_current) || t[t.length - 1] || { id: null }).id);
        }
      } catch (e: any) {
        setError(e && e.message ? e.message : 'Could not load sessions.');
      }
      if (alive) {
        setReady(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [ctx, active]);

  const pickSession = async (id: string) => {
    const t = await fetchTermOptions(id);
    setTerms(t);
    setSessionId(id);
    setTermId((t.find(x => x.is_current) || t[0] || { id: null }).id);
  };

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    const mine = ++ticket.current;
    try {
      setError('');
      const result = await loadOverview({ schoolId: ctx.schoolId, userId: ctx.userId, isAdmin: ctx.isAdmin, canSeeFees }, sessionId, termId);
      if (mine === ticket.current) {
        setData(result);
      }
    } catch (e: any) {
      if (mine === ticket.current) {
        setError(e && e.message ? e.message : 'Could not load the overview.');
      }
    }
  }, [ctx, canSeeFees, sessionId, termId]);

  useEffect(() => {
    if (ready && active) {
      setData(null);
      load();
    }
  }, [ready, active, load]);

  // The attendance chart has its own filters.
  useEffect(() => {
    if (!data) {
      return;
    }
    let alive = true;
    setBars(null);
    fetchAttendanceBars(data.classes, classFilter, period as any, termId, terms).then(b => {
      if (alive) {
        setBars(b);
      }
    });
    return () => {
      alive = false;
    };
  }, [data ? data.classes : null, classFilter, period, termId, terms]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (ctxLoading || !ctx) {
    return (
      <Screen>
        <Skeleton height={160} radius={24} />
      </Screen>
    );
  }
  if (!active) {
    return (
      <Screen>
        <EmptyState icon="lock" title="Subscription needed" message="Renew the subscription to continue using the School Overview." />
        <Button title="Open subscription" onPress={() => navigation.navigate('Subscription')} />
      </Screen>
    );
  }

  const d = data;
  const open = (title: string, sub: string | undefined, body: React.ReactNode) => setSheet({ title, sub, body });

  // ---- Derived pieces ----
  const insightText: string[] = [];
  let insightActions: string[] = [];
  if (d && d.health) {
    const att = d.needsAttention.find(i => i.title.includes('Absence'));
    const acad = d.needsAttention.find(i => i.title.includes('Performance'));
    insightText.push(att ? 'Repeated student absences have increased this week.' : 'Attendance is stable overall.');
    if (acad) {
      insightText.push(acad.title.replace('Low ', '').replace(' Performance', '') + ' currently has the lowest school wide average.');
    }
    if (d.positiveProgress.length === 0 && d.needsAttention.length > 0) {
      insightText.push('Several students have experienced measurable decline this period.');
    }
    insightActions = d.needsAttention.slice(0, 5).map(i => i.action.replace(/\.$/, ''));
  }
  const healthColor = d && d.health ? (d.health.tier === 'green' ? GREEN : d.health.tier === 'yellow' ? AMBER : RED) : GREEN;
  const academic = d && d.academic;
  const subjects: any[] = academic && academic.health && academic.health.has_data ? academic.health.subjects || [] : [];
  const students: any[] = academic && academic.movers && academic.movers.has_data ? academic.movers.students || [] : [];
  const patterns = academic && academic.patterns && academic.patterns.has_data ? academic.patterns : { weaknesses: [], hidden_strengths: [] };

  const classAverages = (() => {
    const by: Record<string, { t: number; n: number }> = {};
    students.forEach(s => {
      by[s.class_name] = by[s.class_name] || { t: 0, n: 0 };
      by[s.class_name].t += s.overall_pct;
      by[s.class_name].n++;
    });
    return Object.entries(by).map(([n, v]) => ({ name: n, avg: v.t / v.n })).sort((a, b) => b.avg - a.avg);
  })();

  const tiles = (() => {
    const top = students.slice().sort((a, b) => b.overall_pct - a.overall_pct).slice(0, 5);
    const improved = students.filter(s => s.rank_change > 0).sort((a, b) => b.rank_change - a.rank_change).slice(0, 5);
    const declining = students.filter(s => s.rank_change < 0).sort((a, b) => a.rank_change - b.rank_change).slice(0, 5);
    const weak = (patterns.weaknesses || []).slice(0, 5);
    const hidden = (patterns.hidden_strengths || []).slice(0, 5);
    return [
      { key: 'top', icon: 'trend' as IconName, label: 'Top performers', rows: top.map(s => <ListRow key={s.name + s.class_name} name={s.name} meta={s.class_name + ', position ' + s.rank} figure={s.overall_pct + '%'} figureColor={GREEN} />) },
      { key: 'improved', icon: 'up' as IconName, label: 'Most improved', rows: improved.map(s => <ListRow key={s.name + s.class_name} name={s.name} meta={s.class_name + ', ' + s.prev_rank + ' to ' + s.rank} figure={'Up ' + s.rank_change} figureColor={GREEN} />) },
      { key: 'declining', icon: 'down' as IconName, label: 'Declining students', rows: declining.map(s => <ListRow key={s.name + s.class_name} name={s.name} meta={s.class_name + ', ' + s.prev_rank + ' to ' + s.rank} figure={'Down ' + Math.abs(s.rank_change)} />) },
      { key: 'weakness', icon: 'info' as IconName, label: 'Subject weakness', rows: weak.map((w: any, i: number) => <ListRow key={i} name={w.name} meta={'Overall ' + w.overall_pct + '%, ' + w.subject_name + ' ' + w.subject_pct + '%'} figure={w.subject_name} />) },
      { key: 'hidden', icon: 'shieldCheck' as IconName, label: 'Hidden strengths', rows: hidden.map((h: any, i: number) => <ListRow key={i} name={h.name} meta={'Ranks ' + h.overall_rank + ' overall, top ' + h.subject_rank + ' in ' + h.subject_name} figure={h.subject_name} figureColor={GREEN} />) },
    ].filter(t => t.rows.length > 0);
  })();

  const withPrev = students.filter(s => s.prev_pct !== null && s.prev_pct !== undefined);
  const openInsights = d ? d.insights.filter(r => r.status !== 'resolved').sort((a, b) => PRIORITY_ORDER[insightPriority(a)] - PRIORITY_ORDER[insightPriority(b)]) : [];
  const histRows = d ? d.insights.filter(r => !hist || r.status === hist) : [];

  const genderSegs = d && d.gender
    ? [
        { label: 'Male', count: d.gender.male, color: '#4B7EE8' },
        { label: 'Female', count: d.gender.female, color: '#E8823C' },
        ...(d.gender.unspecified ? [{ label: 'Not specified', count: d.gender.unspecified, color: '#6B7280' }] : []),
      ]
    : [];
  const genderTotal = genderSegs.reduce((s, x) => s + x.count, 0);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View>
          <Text style={[text.h2, { color: colors.text }]}>School Overview</Text>
          <Text style={[text.small, { color: colors.textMuted }]}>
            {name ? 'Welcome back, ' + name : ctx.school.name}
          </Text>
        </View>

        {sessions.length ? (
          <View>
            <OptionField compact label="Session" value={sessionId || ''} options={sessions.map(s => ({ value: s.id, label: s.name }))} onChange={pickSession} />
            {terms.length ? <FilterChips options={terms.map(t => ({ key: t.id, label: t.name }))} value={termId || ''} onChange={setTermId} /> : <Muted>No terms in this session yet.</Muted>}
          </View>
        ) : ready ? (
          <Muted>No sessions yet. Create one in Sessions and Terms to see academic figures.</Muted>
        ) : null}

        {error ? <Callout>{error}</Callout> : null}

        {!d ? (
          <View style={{ gap: spacing.lg }}>
            <Skeleton height={110} radius={22} />
            <Skeleton height={90} radius={22} />
            <Skeleton height={180} radius={22} />
          </View>
        ) : (
          <>
            {isAdmin && d.health ? (
              <View style={styles.health}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <View style={[styles.healthIcon, { backgroundColor: healthColor + '22' }]}>
                      <Icon name="building" size={20} color={healthColor} />
                    </View>
                    <View>
                      <Text style={[text.bodyStrong, { color: colors.text }]}>School Health</Text>
                      <Pill label={d.health.statusLabel} color={healthColor} bg={healthColor + '22'} />
                    </View>
                  </View>
                  <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.md }]}>{d.health.explainer}</Text>
                </View>
                <Ring score={d.health.overall} suffix="" color={healthColor} caption="Health Score" />
              </View>
            ) : null}

            <View style={styles.stats}>
              <Pressable style={[styles.stat, { borderLeftColor: colors.primary }]} onPress={() => navigation.navigate('Roster', { type: 'students' })}>
                <Text style={[text.h2, { color: colors.primary }]}>{String(d.studentCount)}</Text>
                <Text style={[text.caption, { color: colors.textMuted }]}>Students</Text>
              </Pressable>
              <Pressable style={[styles.stat, { borderLeftColor: colors.accent }]} onPress={() => navigation.navigate('Roster', { type: 'staff' })}>
                <Text style={[text.h2, { color: colors.primary }]}>{String(d.staffCount)}</Text>
                <Text style={[text.caption, { color: colors.textMuted }]}>Staff</Text>
              </Pressable>
              <View style={[styles.stat, { borderLeftColor: GREEN }]}>
                <Text style={[text.h2, { color: colors.primary }]}>{d.attendanceRate + '%'}</Text>
                <Text style={[text.caption, { color: colors.textMuted }]}>Attendance</Text>
              </View>
            </View>

            {isAdmin && d.health ? (
              <View style={styles.insight}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[text.bodyStrong, { color: '#FFFFFF' }]}>Scholin School Insight</Text>
                  <Text style={styles.badgeLight}>System generated</Text>
                </View>
                <Text style={[text.small, { color: '#DCE6FF', marginTop: 6 }]}>{'School status: ' + d.health.statusLabel}</Text>
                <Text style={[text.small, { color: '#FFFFFF', marginTop: 4 }]}>{insightText.join(' ')}</Text>
                {insightActions.map((a, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Text style={styles.num}>{String(i + 1)}</Text>
                    <Text style={[text.small, { color: '#FFFFFF', flex: 1 }]}>{a}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {d.needsAttention.length ? (
              <SectionCard title={'Needs Attention (' + d.needsAttention.length + ')'} hint="Issues found in your school's real data. Tap one for details.">
                {d.needsAttention.map((item, i) => {
                  const st = PRIORITY_STYLE[item.priority];
                  return (
                    <Pressable
                      key={i}
                      style={[styles.attn, i > 0 && styles.divider]}
                      onPress={() => open(item.title, item.action, <View>{detailBody(item)}<Text style={[text.small, { color: colors.textMuted, marginTop: spacing.md }]}>{item.why}</Text></View>)}>
                      <View style={[styles.attnIcon, { backgroundColor: st.bg }]}>
                        <Icon name={item.icon as IconName} size={17} color={st.fg} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]}>{item.title}</Text>
                          <Pill label={item.priority} color={st.fg} bg={st.bg} />
                        </View>
                        <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>{item.detail}</Text>
                        <Text style={[text.small, { color: colors.primary, marginTop: 2 }]}>{'Action: ' + item.action}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </SectionCard>
            ) : null}

            {d.positiveProgress.length ? (
              <SectionCard title="Positive Progress" hint="Verified improvements this period">
                {d.positiveProgress.map((t, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 5, alignItems: 'center' }}>
                    <View style={styles.check}>
                      <Icon name="check" size={12} color="#2F7A4F" />
                    </View>
                    <Text style={[text.small, { color: colors.text, flex: 1 }]}>{t}</Text>
                  </View>
                ))}
              </SectionCard>
            ) : null}

            <SectionCard title="Academic Performance" hint="Students across grade bands">
              {d.gradeBands.length === 0 ? (
                <Muted>No results recorded for this term yet.</Muted>
              ) : (
                d.gradeBands.map((b, i) => <BarRow key={b.grade} label={b.grade} value={b.count} max={Math.max(...d.gradeBands.map(x => x.count), 1)} color={BAND_COLORS[i % BAND_COLORS.length]} right={b.count + ' (' + b.pct + '%)'} />)
              )}
            </SectionCard>

            {isAdmin && subjects.length ? (
              <SectionCard title="Subject Health" hint="How each subject is doing this term">
                {subjects.map((s, i) => {
                  const strong = s.avg_score >= 70;
                  const good = s.avg_score >= 60;
                  const delta = s.prev_avg !== null && s.prev_avg !== undefined ? s.avg_score - s.prev_avg : null;
                  return (
                    <View key={i} style={[styles.subject, i > 0 && styles.divider]}>
                      <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]} numberOfLines={1}>{s.name}</Text>
                      <Text style={[text.bodyStrong, { color: colors.text }]}>{s.avg_score + '%'}</Text>
                      {delta !== null && Math.abs(delta) >= 0.5 ? (
                        <Text style={[text.caption, { color: delta > 0 ? GREEN : RED, width: 52, textAlign: 'right' }]}>{(delta > 0 ? 'Up ' : 'Down ') + Math.abs(delta).toFixed(1) + '%'}</Text>
                      ) : null}
                      <Pill label={strong ? 'Strong' : good ? 'Good' : 'Attention'} color={strong || good ? GREEN : RED} bg={strong || good ? '#E5F1E9' : '#FBE4E2'} />
                    </View>
                  );
                })}
                {(() => {
                  const withTrend = subjects.filter(s => s.prev_avg !== null && s.prev_avg !== undefined);
                  const strongest = subjects.slice().sort((a, b) => b.avg_score - a.avg_score)[0];
                  const weakest = subjects.slice().sort((a, b) => a.avg_score - b.avg_score)[0];
                  const best = withTrend.slice().sort((a, b) => b.avg_score - b.prev_avg - (a.avg_score - a.prev_avg))[0];
                  const worst = withTrend.slice().sort((a, b) => a.avg_score - a.prev_avg - (b.avg_score - b.prev_avg))[0];
                  const items: { label: string; value: string; tone?: 'up' | 'down' }[] = [
                    { label: 'Strongest subject', value: strongest.name + ' ' + strongest.avg_score + '%' },
                    { label: 'Weakest subject', value: weakest.name + ' ' + weakest.avg_score + '%' },
                  ];
                  if (best && best.avg_score - best.prev_avg > 0.5) {
                    items.push({ label: 'Most improved', value: best.name + ' +' + (best.avg_score - best.prev_avg).toFixed(1) + '%', tone: 'up' });
                  }
                  if (worst && worst.avg_score - worst.prev_avg < -0.5) {
                    items.push({ label: 'Declining subject', value: worst.name + ' ' + (worst.avg_score - worst.prev_avg).toFixed(1) + '%', tone: 'down' });
                  }
                  return <Highlights items={items} />;
                })()}
              </SectionCard>
            ) : null}

            {isAdmin && classAverages.length >= 2 ? (
              <SectionCard title="Class Performance" hint="Compared across all classes this term">
                <BadgeGrid
                  items={[
                    { label: 'Best class', value: classAverages[0].name + ' ' + classAverages[0].avg.toFixed(0) + '%' },
                    { label: 'Needs attention', value: classAverages[classAverages.length - 1].name + ' ' + classAverages[classAverages.length - 1].avg.toFixed(0) + '%' },
                  ]}
                />
              </SectionCard>
            ) : null}

            {isAdmin && tiles.length ? (
              <SectionCard title="Academic Intelligence" hint="Tap a tile for the list">
                <View style={styles.tileGrid}>
                  {tiles.map(t => (
                    <Pressable key={t.key} style={[styles.tile, tile === t.key && { borderColor: colors.primary }]} onPress={() => setTile(tile === t.key ? '' : t.key)}>
                      <Icon name={t.icon} size={18} color={colors.primary} />
                      <Text style={[text.h3, { color: colors.primary }]}>{String(t.rows.length)}</Text>
                      <Text style={[text.caption, { color: colors.textMuted, textAlign: 'center' }]}>{t.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {tiles.filter(t => t.key === tile).map(t => (
                  <View key={t.key} style={{ marginTop: spacing.md }}>{t.rows}</View>
                ))}
              </SectionCard>
            ) : null}

            {isAdmin && withPrev.length ? (
              <SectionCard title="Report Card Intelligence" hint="How students moved compared with last term">
                {(() => {
                  let improved = 0;
                  let declined = 0;
                  let little = 0;
                  withPrev.forEach(s => {
                    const delta = s.overall_pct - s.prev_pct;
                    if (delta > 2) {
                      improved++;
                    } else if (delta < -2) {
                      declined++;
                    } else {
                      little++;
                    }
                  });
                  const n = withPrev.length;
                  return (
                    <Highlights
                      items={[
                        { label: 'School average', value: (academic!.health ? academic!.health.overall_avg : '') + '%' },
                        { label: 'Improved', value: Math.round((improved / n) * 100) + '%', tone: 'up' },
                        { label: 'Declined', value: Math.round((declined / n) * 100) + '%', tone: 'down' },
                        { label: 'Little change', value: Math.round((little / n) * 100) + '%' },
                      ]}
                    />
                  );
                })()}
              </SectionCard>
            ) : null}

            {isAdmin && students.length ? (
              <SectionCard title="Student Performance Classification" hint="Based on measurable patterns only, never a personal label">
                {(() => {
                  const b: Record<string, number> = { stable: 0, improving: 0, declining: 0, needs_attention: 0, critical: 0 };
                  students.forEach(s => {
                    if (b[s.classification] !== undefined) {
                      b[s.classification]++;
                    }
                  });
                  return (
                    <BadgeGrid
                      items={[
                        { label: 'Stable', value: String(b.stable) },
                        { label: 'Improving', value: String(b.improving) },
                        { label: 'Declining', value: String(b.declining) },
                        { label: 'Needs attention', value: String(b.needs_attention) },
                        { label: 'Critical', value: String(b.critical) },
                      ]}
                    />
                  );
                })()}
              </SectionCard>
            ) : null}

            {isAdmin && d.attendanceIntel && d.attendanceIntel.thisWeek && d.attendanceIntel.thisWeek.has_data ? (
              <SectionCard title="Student Attendance Intelligence" hint="This week, all classes">
                {(() => {
                  const a = d.attendanceIntel!;
                  const rows: { color: string; label: string; value: string | number }[] = [];
                  if (a.today && a.today.has_data) {
                    rows.push({ color: RED, label: 'Absent today', value: a.today.absent });
                  }
                  rows.push({ color: AMBER, label: 'Repeated absences', value: a.repeated.length });
                  rows.push({ color: AMBER, label: 'Consecutive absences', value: a.consecutive.length });
                  if (a.prevWeek && a.prevWeek.has_data && a.thisWeek.rate - a.prevWeek.rate <= -2) {
                    rows.push({ color: RED, label: 'Declining attendance', value: (a.prevWeek.rate - a.thisWeek.rate).toFixed(1) + '%' });
                  }
                  return (
                    <View>
                      <RingList ring={<Ring score={a.thisWeek.rate} color={tierColor(a.thisWeek.rate)} caption="Overall attendance" />}>
                        {rows.map(r => <DotRow key={r.label} color={r.color} label={r.label} value={r.value} />)}
                      </RingList>
                      {a.repeated.length ? <Callout>{a.repeated[0].name + ': absent ' + a.repeated[0].absence_count + ' times this week. Contact the parent or guardian.'}</Callout> : null}
                    </View>
                  );
                })()}
              </SectionCard>
            ) : null}

            {isAdmin && d.register && d.register.has_data ? (
              <SectionCard title="Register and Attendance Record Health" hint="Whether daily registers are being completed">
                <RingList ring={<Ring score={d.register.completion_rate} color={tierColor(d.register.completion_rate)} caption="Completion rate" />}>
                  <DotRow color={AMBER} label="Missing records" value={d.register.missing_records} />
                  <DotRow color={RED} label="Classes not recorded" value={d.register.classes_not_recorded_recently} />
                </RingList>
                {d.register.classes_not_recorded_recently > 0 ? (
                  <Callout>{d.register.classes_not_recorded_recently + ' class' + (d.register.classes_not_recorded_recently === 1 ? '' : 'es') + ' not recorded in the last 2 school days.'}</Callout>
                ) : null}
              </SectionCard>
            ) : null}

            <SectionCard title="Attendance" hint="How often students have been coming to school">
              <FilterChips options={[{ key: 'all', label: 'All classes' }, ...d.classes.map(c => ({ key: c.id, label: c.name }))]} value={classFilter} onChange={setClassFilter} />
              <FilterChips options={PERIODS} value={period} onChange={setPeriod} />
              <View style={{ marginTop: spacing.sm }}>
                {bars === null ? <Skeleton height={150} radius={16} /> : bars.length === 0 ? <Muted>No attendance data recorded for this selection yet.</Muted> : <Columns bars={bars} />}
              </View>
            </SectionCard>

            <SectionCard title="Recent Activity" hint="The latest things happening in your school">
              {d.activity.length === 0 ? (
                <Muted>No recent activity yet.</Muted>
              ) : (
                d.activity.map((r, i) => (
                  <Pressable
                    key={i}
                    disabled={!(r.activity_type === 'announcement_posted' && r.related_announcement_id)}
                    onPress={() => navigation.navigate('AnnouncementDetail', { id: r.related_announcement_id })}
                    style={[styles.activity, i > 0 && styles.divider]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[text.bodyStrong, { color: colors.text }]}>{r.title}</Text>
                      {r.detail ? <Text style={[text.small, { color: colors.textMuted }]} numberOfLines={2}>{r.detail}</Text> : null}
                    </View>
                    <Text style={[text.caption, { color: colors.textMuted }]}>{timeShort(r.created_at)}</Text>
                  </Pressable>
                ))
              )}
              <Pressable onPress={() => navigation.navigate('ActivityLog')} style={{ marginTop: spacing.md, alignSelf: 'flex-end' }}>
                <Text style={[text.small, { color: colors.primary, fontWeight: '700' }]}>View all activity</Text>
              </Pressable>
            </SectionCard>

            {isAdmin ? (
              <>
                {canSeeFees && d.finance ? (
                  <SectionCard title="Finance Snapshot" hint="Fees collected so far, across all fee items">
                    {d.finance.expected === 0 ? (
                      <Muted>No fee items created yet.</Muted>
                    ) : (
                      <BadgeGrid
                        items={[
                          { label: 'Expected', value: money(d.finance.expected) },
                          { label: 'Collected', value: money(d.finance.collected) },
                          { label: 'Outstanding', value: money(d.finance.outstanding) },
                          { label: 'Collection rate', value: d.finance.rate !== null ? d.finance.rate + '%' : 'None' },
                        ]}
                      />
                    )}
                    <Pressable onPress={() => navigation.navigate('Events')} style={{ marginTop: spacing.md, alignSelf: 'flex-end' }}>
                      <Text style={[text.small, { color: colors.primary, fontWeight: '700' }]}>Manage fees</Text>
                    </Pressable>
                  </SectionCard>
                ) : null}

                <SectionCard title="Students by Gender">
                  {genderTotal === 0 ? (
                    <Muted>No students enrolled yet.</Muted>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
                      <Donut segments={genderSegs} />
                      <View style={{ flex: 1 }}>
                        {genderSegs.map(s => <DotRow key={s.label} color={s.color} label={s.label + ' ' + Math.round((s.count / genderTotal) * 100) + '%'} value={s.count} />)}
                      </View>
                    </View>
                  )}
                </SectionCard>

                <SectionCard title="Staff Punctuality" hint="Last 30 days">
                  {!d.punctuality || !d.punctuality.data || !d.punctuality.data.has_data ? (
                    <Muted>Not enough data yet.</Muted>
                  ) : (
                    <View>
                      <RingList ring={<Ring score={d.punctuality.data.rate} color={tierColor(d.punctuality.data.rate)} caption="Attendance rate" />}>
                        <DotRow color={GREEN} label="Present" value={d.punctuality.data.present} />
                        <DotRow color={RED} label="Absent" value={d.punctuality.data.absent} />
                        <DotRow color={AMBER} label="Late arrivals" value={d.punctuality.data.late} />
                      </RingList>
                      <Highlights items={[{ label: 'Average clock in', value: d.punctuality.data.avg_clock_in || 'None' }, { label: 'Average clock out', value: d.punctuality.data.avg_clock_out || 'None' }]} />
                      {d.punctuality.staffLate.length ? (
                        <Callout>{d.punctuality.staffLate.length + ' staff member' + (d.punctuality.staffLate.length === 1 ? '' : 's') + ' recorded repeated late arrivals this month. Review individually and privately.'}</Callout>
                      ) : null}
                    </View>
                  )}
                </SectionCard>

                {d.assessment && d.assessment.has_data ? (
                  <SectionCard title="Assessment Completion" hint="Results entered for this term">
                    <RingList ring={<Ring score={d.assessment.completion_rate} color={tierColor(d.assessment.completion_rate)} caption="Overall completion" />}>
                      <DotRow color={GREEN} label="Results entered" value={d.assessment.entered + '/' + d.assessment.expected} />
                      <DotRow color={AMBER} label="Missing results" value={d.assessment.missing} />
                      <DotRow color={RED} label="Incomplete classes" value={d.assessment.incomplete_classes} />
                    </RingList>
                    {d.assessment.missing > 0 ? (
                      <Pressable onPress={() => navigation.navigate('ResultsStatus')} style={{ marginTop: spacing.md, alignSelf: 'flex-end' }}>
                        <Text style={[text.small, { color: colors.primary, fontWeight: '700' }]}>View missing results</Text>
                      </Pressable>
                    ) : null}
                  </SectionCard>
                ) : null}

                {d.enrollment && d.enrollment.has_data ? (
                  <SectionCard title="Enrollment">
                    <Highlights
                      items={[
                        { label: 'Total students', value: String(d.enrollment.total_students) },
                        { label: 'New admissions', value: String(d.enrollment.new_admissions) },
                        { label: 'Withdrawals', value: String(d.enrollment.withdrawals) },
                        { label: 'Male / Female', value: d.enrollment.male + ' / ' + d.enrollment.female },
                      ]}
                    />
                    {d.enrollment.per_class && d.enrollment.per_class.length ? (
                      <View style={{ marginTop: spacing.md }}>
                        <Muted>Students per class</Muted>
                        <BadgeGrid items={d.enrollment.per_class.map((c: any) => ({ label: c.class_name, value: String(c.student_count) }))} />
                      </View>
                    ) : null}
                    {d.enrollment.capacity_alerts && d.enrollment.capacity_alerts.length ? (
                      <Callout>{d.enrollment.capacity_alerts[0].class_name + ' is at ' + d.enrollment.capacity_alerts[0].pct_full + '% of its ' + d.enrollment.capacity_alerts[0].capacity + ' student capacity.'}</Callout>
                    ) : null}
                  </SectionCard>
                ) : null}

                {d.trends.length ? (
                  <SectionCard title="School Trends" hint="This period compared with the one before it">
                    {d.trends.map(t => {
                      const dir = t.delta > 0.5 ? 'up' : t.delta < -0.5 ? 'down' : 'stable';
                      return <DotRow key={t.label} label={t.label} value={(dir === 'up' ? 'Up ' : dir === 'down' ? 'Down ' : 'Steady ') + Math.abs(t.delta).toFixed(1) + '%'} valueColor={dir === 'up' ? GREEN : dir === 'down' ? RED : colors.text} />;
                    })}
                  </SectionCard>
                ) : null}

                {openInsights.length ? (
                  <SectionCard title="Action Center" hint="Everything open right now, by priority">
                    {openInsights.map((row, i) => {
                      const label = insightLabel(row);
                      const p = PRIORITY_STYLE[insightPriority(row)];
                      const st = STATUS_STYLE[row.status] || STATUS_STYLE.resolved;
                      return (
                        <Pressable
                          key={i}
                          style={[styles.action, i > 0 && styles.divider]}
                          onPress={() =>
                            open(
                              label.title,
                              CATEGORY_LABEL[row.category] || row.category,
                              <View>
                                <ListRow name="Status" figure={row.status} figureColor={st.fg} />
                                <ListRow name="First detected" figure={row.first_detected_at ? new Date(row.first_detected_at).toLocaleDateString() : 'None'} figureColor={colors.textMuted} />
                                <ListRow name="Last updated" figure={row.last_updated_at ? new Date(row.last_updated_at).toLocaleDateString() : 'None'} figureColor={colors.textMuted} />
                                {row.current_value !== null && row.current_value !== undefined ? <ListRow name="Current value" figure={String(row.current_value)} figureColor={colors.primary} /> : null}
                                {row.previous_value !== null && row.previous_value !== undefined ? <ListRow name="Previous value" figure={String(row.previous_value)} figureColor={colors.textMuted} /> : null}
                              </View>,
                            )
                          }>
                          <View style={[styles.priorityDot, { backgroundColor: p.fg }]} />
                          <View style={{ flex: 1 }}>
                            <Text style={[text.bodyStrong, { color: colors.text }]}>{label.title}</Text>
                            <Text style={[text.small, { color: colors.textMuted }]}>{label.sub}</Text>
                          </View>
                          <Pill label={row.status} color={st.fg} bg={st.bg} />
                        </Pressable>
                      );
                    })}
                  </SectionCard>
                ) : null}

                {d.dataQuality && d.dataQuality.has_data ? (
                  <SectionCard title="Data Quality" hint="How complete your records are">
                    <RingList ring={<Ring score={Math.round(d.dataQuality.completion_rate)} color={tierColor(d.dataQuality.completion_rate)} caption="Records complete" size={86} />}>
                      <DotRow label="Attendance registers" value={d.dataQuality.missing_registers} valueColor={d.dataQuality.missing_registers === 0 ? GREEN : colors.text} />
                      <DotRow label="Student profiles" value={d.dataQuality.incomplete_profiles} valueColor={d.dataQuality.incomplete_profiles === 0 ? GREEN : colors.text} />
                      <DotRow label="Missing results" value={d.dataQuality.missing_results} valueColor={d.dataQuality.missing_results === 0 ? GREEN : colors.text} />
                    </RingList>
                  </SectionCard>
                ) : null}

                {d.insights.length ? (
                  <SectionCard title="Insight History" hint="How issues have changed over time">
                    <FilterChips options={HIST} value={hist} onChange={setHist} />
                    {histRows.length === 0 ? (
                      <Muted>Nothing here yet.</Muted>
                    ) : (
                      histRows.map((row, i) => {
                        const label = insightLabel(row);
                        const st = STATUS_STYLE[row.status] || STATUS_STYLE.resolved;
                        return (
                          <View key={i} style={[styles.activity, i > 0 && styles.divider]}>
                            <Pill label={row.status} color={st.fg} bg={st.bg} />
                            <View style={{ flex: 1 }}>
                              <Text style={[text.small, { color: colors.text, fontWeight: '600' }]}>{label.title + ', ' + (CATEGORY_LABEL[row.category] || row.category)}</Text>
                              <Text style={[text.caption, { color: colors.textMuted }]}>{'Updated ' + new Date(row.last_updated_at).toLocaleDateString() + '. ' + label.sub}</Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </SectionCard>
                ) : null}
              </>
            ) : d.myAttendance ? (
              <SectionCard title="My Attendance" hint="Your personal attendance summary. Only you can see this.">
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <View style={styles.personal}>
                    <Text style={[text.h2, { color: colors.primary }]}>{String(d.myAttendance.present)}</Text>
                    <Text style={[text.caption, { color: colors.textMuted }]}>Days present</Text>
                  </View>
                  <View style={styles.personal}>
                    <Text style={[text.h2, { color: AMBER }]}>{String(d.myAttendance.late)}</Text>
                    <Text style={[text.caption, { color: colors.textMuted }]}>Times late</Text>
                  </View>
                </View>
              </SectionCard>
            ) : null}
          </>
        )}
      </ScrollView>

      <BottomSheet visible={!!sheet} onClose={() => setSheet(null)} title={sheet ? sheet.title : ''}>
        {sheet ? (
          <View>
            {sheet.sub ? <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>{sheet.sub}</Text> : null}
            {sheet.body || <Muted>No further detail available for this item.</Muted>}
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  health: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  healthIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3 },
  insight: { backgroundColor: '#14233F', borderRadius: radius.xl, padding: spacing.lg },
  badgeLight: { fontSize: 10, fontWeight: '700', color: '#DCE6FF', backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  num: { width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFFFFF', fontSize: 11, fontWeight: '700', textAlign: 'center', lineHeight: 18, overflow: 'hidden' },
  attn: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  attnIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  check: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E5F5E7', alignItems: 'center', justifyContent: 'center' },
  subject: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { width: '30%', flexGrow: 1, alignItems: 'center', gap: 2, backgroundColor: colors.background, borderRadius: 14, paddingVertical: spacing.md, paddingHorizontal: 6, borderWidth: 1.5, borderColor: 'transparent' },
  activity: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.sm },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  priorityDot: { width: 9, height: 9, borderRadius: 5 },
  personal: { flex: 1, backgroundColor: colors.background, borderRadius: 16, padding: spacing.lg, alignItems: 'center' },
});
