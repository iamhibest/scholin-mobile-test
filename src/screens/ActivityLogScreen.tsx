import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomSheet, Button, EmptyState, Icon, LinkedText, Notice, PressableScale, Screen, Skeleton } from '../components';
import { IconName } from '../components/Icon';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { naira } from '../lib/format';
import { methodLabel } from '../lib/events';
import { fetchAnnouncement } from '../lib/announcements';
import { ACTIVITY_PAGE, fetchActivityPage, fetchMembershipDetail, fetchPaymentDetail, fetchTermDetail, markActivitySeen } from '../lib/staffTools';

const KIND: Record<string, { icon: IconName; bg: string; fg: string }> = {
  report_card_published: { icon: 'file', bg: '#E8F0FF', fg: '#1A56DB' },
  payment_received: { icon: 'check', bg: '#E6F7EE', fg: '#13804A' },
  teacher_join_accepted: { icon: 'userPlus', bg: '#F3E8FF', fg: '#7E22CE' },
  announcement_posted: { icon: 'megaphone', bg: '#FFF1E0', fg: '#B45309' },
};

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) {
    return 'Today';
  }
  if (d.toDateString() === y.toDateString()) {
    return 'Yesterday';
  }
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function ago(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) {
    return 'just now';
  }
  if (mins < 60) {
    return mins + 'm ago';
  }
  const h = Math.floor(mins / 60);
  return h < 24 ? h + 'h ago' : Math.floor(h / 24) + 'd ago';
}

function Row({ item, index, onPress }: { item: any; index: number; onPress: (() => void) | null }) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 360, delay: Math.min(index, 8) * 45, useNativeDriver: true }).start();
  }, [enter, index]);
  const k = KIND[item.activity_type] || { icon: 'info' as IconName, bg: '#EEF1F6', fg: colors.textMuted };
  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
      <PressableScale disabled={!onPress} onPress={onPress || undefined} to={0.985} style={styles.row}>
        <View style={[styles.icon, { backgroundColor: k.bg }]}>
          <Icon name={k.icon} size={18} color={k.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.bodyStrong, { color: colors.text }]}>{item.title}</Text>
          {item.detail ? <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={2}>{item.detail}</Text> : null}
          <Text style={[text.caption, { color: colors.textMuted, marginTop: 4 }]}>{ago(item.created_at)}</Text>
        </View>
        {onPress ? <Icon name="chevron" size={18} color={colors.textMuted} /> : null}
      </PressableScale>
    </Animated.View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <Text style={[text.small, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[text.small, { color: colors.text, flex: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

export default function ActivityLogScreen() {
  const navigation = useNavigation<any>();
  const { ctx, loading: ctxLoading } = useStaff();
  const [rows, setRows] = useState<any[] | null>(null);
  const [more, setMore] = useState(false);
  const [busyMore, setBusyMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<{ title: string; body: React.ReactNode } | null>(null);

  const first = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      setError('');
      markActivitySeen();
      const page = await fetchActivityPage(ctx.schoolId, 0);
      setRows(page);
      setMore(page.length === ACTIVITY_PAGE);
    } catch (e: any) {
      setRows([]);
      setError(e.message);
    }
  }, [ctx]);

  useEffect(() => {
    first();
  }, [first]);

  const loadMore = async () => {
    if (!ctx || !rows || busyMore) {
      return;
    }
    setBusyMore(true);
    try {
      const page = await fetchActivityPage(ctx.schoolId, rows.length);
      setRows(rows.concat(page));
      setMore(page.length === ACTIVITY_PAGE);
    } catch (e: any) {
      setError(e.message);
    }
    setBusyMore(false);
  };

  const open = async (r: any) => {
    try {
      if (r.activity_type === 'announcement_posted' && r.related_announcement_id) {
        navigation.navigate('AnnouncementDetail', { id: r.related_announcement_id });
      } else if (r.activity_type === 'payment_received' && r.related_payment_id) {
        const p = await fetchPaymentDetail(r.related_payment_id);
        if (!p) {
          setError('This payment could not be found.');
          return;
        }
        setSheet({
          title: 'Payment details',
          body: (
            <View>
              <Line label="Fee" value={(p.events && p.events.name) || '-'} />
              <Line label="Student" value={(p.students && p.students.full_name) || '-'} />
              <Line label="Amount" value={naira(Number(p.amount))} />
              <Line label="Method" value={p.payment_method === 'online' ? 'Paid online' : methodLabel(p.payment_method)} />
              <Line label="Date" value={new Date(p.payment_date).toLocaleString('en-GB')} />
              <Line label="Receipt" value={p.receipt_number} />
              {p.notes ? <Line label="Notes" value={p.notes} /> : null}
            </View>
          ),
        });
      } else if (r.activity_type === 'report_card_published' && r.related_term_id) {
        const t = await fetchTermDetail(r.related_term_id);
        setSheet({
          title: 'Report card publish details',
          body: (
            <View>
              <Line label="Class" value={String(r.title).replace(/^Report cards published for /, '')} />
              <Line label="Term" value={(t && t.name) || r.detail || '-'} />
              {t && t.sessions && t.sessions.name ? <Line label="Session" value={t.sessions.name} /> : null}
              {t && t.term_end_date ? <Line label="Term ends" value={new Date(t.term_end_date).toLocaleDateString('en-GB')} /> : null}
              {t && t.next_term_resumes ? <Line label="Next term resumes" value={new Date(t.next_term_resumes).toLocaleDateString('en-GB')} /> : null}
            </View>
          ),
        });
      } else if (r.activity_type === 'teacher_join_accepted' && r.related_membership_id) {
        const m = await fetchMembershipDetail(r.related_membership_id);
        if (!m) {
          setError('This membership record could not be found.');
          return;
        }
        setSheet({
          title: 'Teacher join details',
          body: (
            <View>
              <Line label="Teacher" value={(m.profiles && m.profiles.full_name) || '-'} />
              {m.profiles && m.profiles.email ? <Line label="Email" value={m.profiles.email} /> : null}
              {m.profiles && m.profiles.phone ? <Line label="Phone" value={m.profiles.phone} /> : null}
              <Line label="Role" value={m.role} />
              <Line label="Requested" value={new Date(m.created_at).toLocaleDateString('en-GB')} />
            </View>
          ),
        });
      }
    } catch (e: any) {
      setError(e.message || 'Could not open this item.');
    }
  };

  if (ctxLoading || (ctx && rows === null)) {
    return (
      <Screen>
        <Skeleton height={80} radius={18} />
        <Skeleton height={80} radius={18} style={{ marginTop: spacing.md }} />
        <Skeleton height={80} radius={18} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  const list = rows || [];

  return (
    <Screen padded={false}>
      <FlatList
        data={list}
        keyExtractor={r => r.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<Notice message={error} tone="error" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await first(); setRefreshing(false); }} />}
        ListEmptyComponent={<EmptyState icon="inbox" title="No activity yet" message="Payments, announcements and report cards will show up here." />}
        ListFooterComponent={more ? <View style={{ marginTop: spacing.md }}>{busyMore ? <ActivityIndicator color={colors.primary} /> : <Button title="Load more" variant="soft" onPress={loadMore} />}</View> : null}
        renderItem={({ item, index }) => {
          const clickable =
            (item.activity_type === 'announcement_posted' && item.related_announcement_id) ||
            (item.activity_type === 'payment_received' && item.related_payment_id) ||
            (item.activity_type === 'report_card_published' && item.related_term_id) ||
            (item.activity_type === 'teacher_join_accepted' && item.related_membership_id);
          const divider = index === 0 || dayLabel(list[index - 1].created_at) !== dayLabel(item.created_at);
          return (
            <View>
              {divider ? <Text style={styles.day}>{dayLabel(item.created_at)}</Text> : null}
              <Row item={item} index={index} onPress={clickable ? () => open(item) : null} />
            </View>
          );
        }}
      />
      <BottomSheet visible={!!sheet} onClose={() => setSheet(null)} title={sheet ? sheet.title : ''}>
        {sheet ? sheet.body : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  day: { fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm, fontFamily: fonts.semibold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: '#EEF1F6' },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.lg, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
});
