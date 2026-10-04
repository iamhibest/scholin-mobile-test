import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { EmptyState, Notice, PressableScale, ReactionBar, Screen, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { fetchAnnouncements, fetchReactions, Reaction, toggleReaction } from '../lib/announcements';
import { shortDate } from '../lib/format';

function Card({ item, index, counts, mine, onOpen, onToggle }: any) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 400, delay: Math.min(index, 7) * 60, useNativeDriver: true }).start();
  }, [enter, index]);
  const body = String(item.body || '');
  const preview = body.length > 160 ? body.slice(0, 160).trim() + '...' : body;
  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
      <View style={styles.card}>
        <View style={[styles.rail, { backgroundColor: item.school_id === null ? colors.purple : colors.primary }]} />
        <PressableScale onPress={onOpen} to={0.985}>
          <View style={styles.meta}>
            <Text style={[text.caption, { color: colors.textMuted }]}>{shortDate(item.created_at)}</Text>
            {item.school_id === null ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Scholin</Text>
              </View>
            ) : null}
          </View>
          <Text style={[text.bodyStrong, { color: colors.text, fontSize: 16, marginTop: 4 }]}>{item.title}</Text>
          {preview ? <Text style={[text.small, { color: colors.textMuted, marginTop: 6, lineHeight: 19 }]}>{preview}</Text> : null}
        </PressableScale>
        <View style={{ marginTop: spacing.md }}>
          <ReactionBar counts={counts} mine={mine} onToggle={onToggle} />
        </View>
      </View>
    </Animated.View>
  );
}

export default function AnnouncementsScreen({ navigation }: any) {
  const { ctx, loading: ctxLoading } = useStaff();
  const [items, setItems] = useState<any[] | null>(null);
  const [reactions, setReactions] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      setError('');
      const list = await fetchAnnouncements(ctx.schoolId);
      setItems(list);
      setReactions(await fetchReactions(list.map(a => a.id)));
    } catch (e: any) {
      setItems([]);
      setError(e.message || 'Could not load announcements.');
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const react = async (announcementId: string, r: Reaction) => {
    if (!ctx) {
      return;
    }
    // Update the screen first so the tap feels instant, then save.
    setReactions(prev => {
      const mineSame = prev.find(x => x.announcement_id === announcementId && x.profile_id === ctx.userId && x.reaction === r);
      const rest = prev.filter(x => !(x.announcement_id === announcementId && x.profile_id === ctx.userId));
      return mineSame ? rest : rest.concat({ id: 'tmp' + Date.now(), announcement_id: announcementId, profile_id: ctx.userId, reaction: r });
    });
    try {
      await toggleReaction(announcementId, ctx.userId, r);
    } catch {}
    setReactions(await fetchReactions((items || []).map(a => a.id)));
  };

  if (ctxLoading || (ctx && items === null)) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={150} radius={20} />
          <Skeleton height={150} radius={20} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={items || []}
        keyExtractor={a => a.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<Notice message={error} tone="error" />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={<EmptyState icon="megaphone" title="No announcements yet" message="Updates from your school and Scholin will appear here." />}
        renderItem={({ item, index }) => {
          const mine = reactions.filter(r => r.announcement_id === item.id && ctx && r.profile_id === ctx.userId).map(r => r.reaction);
          const counts: Record<string, number> = {};
          reactions.filter(r => r.announcement_id === item.id).forEach(r => {
            counts[r.reaction] = (counts[r.reaction] || 0) + 1;
          });
          return <Card item={item} index={index} counts={counts} mine={mine} onOpen={() => navigation.navigate('AnnouncementDetail', { id: item.id })} onToggle={(r: Reaction) => react(item.id, r)} />;
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, paddingLeft: spacing.xl, marginBottom: spacing.md, borderWidth: 1, borderColor: '#EEF1F6', overflow: 'hidden' },
  rail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: '#F3E8FF' },
  badgeText: { fontSize: 10.5, color: '#7E22CE', fontFamily: fonts.semibold },
});
