import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState, LinkedText, Screen, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { fetchAnnouncement } from '../lib/announcements';

export default function AnnouncementDetailScreen({ route }: any) {
  const id: string = route.params.id;
  const [a, setA] = useState<any | null | undefined>(undefined);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchAnnouncement(id)
      .then(r => {
        setA(r || null);
        Animated.timing(enter, { toValue: 1, duration: 480, useNativeDriver: true }).start();
      })
      .catch(() => setA(null));
  }, [id, enter]);

  if (a === undefined) {
    return (
      <Screen>
        <Skeleton height={170} radius={24} />
        <Skeleton height={220} radius={20} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }
  if (!a) {
    return (
      <Screen>
        <EmptyState icon="info" title="Announcement not found" message="This announcement may have been removed." />
      </Screen>
    );
  }

  const slide = { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] };
  const when = new Date(a.created_at);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.hero, { backgroundColor: a.school_id === null ? '#6D28D9' : colors.primary }, slide]}>
          <View style={styles.orb} />
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{a.school_id === null ? 'Scholin' : 'Announcement'}</Text>
          </View>
          <Text style={styles.title}>{a.title}</Text>
          <Text style={styles.when}>{'Posted ' + when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' at ' + when.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}</Text>
        </Animated.View>
        <Animated.View style={[styles.card, slide]}>
          <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Full message</Text>
          {a.body ? <LinkedText value={a.body} style={[text.body, { color: colors.text, lineHeight: 24 }]} /> : <Text style={[text.small, { color: colors.textMuted }]}>This announcement has no message.</Text>}
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  hero: { borderRadius: radius.xl, padding: spacing.xl, overflow: 'hidden' },
  orb: { position: 'absolute', right: -50, top: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.10)' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.2)' },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontFamily: fonts.semibold },
  title: { color: '#FFFFFF', fontSize: 25, lineHeight: 31, marginTop: spacing.lg, fontFamily: fonts.headingBold },
  when: { color: 'rgba(255,255,255,0.82)', fontSize: 12.5, marginTop: spacing.md, fontFamily: fonts.body },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.lg, borderWidth: 1, borderColor: '#EEF1F6' },
});
