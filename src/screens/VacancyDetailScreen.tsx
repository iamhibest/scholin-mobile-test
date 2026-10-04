import React, { useEffect, useRef, useState } from 'react';
import { Animated, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import Share from 'react-native-share';
import { AdSlot, Button, EmptyState, LinkedText, Notice, PressableScale, Screen, SchoolMark, ShineButton, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { canSeePostingDetail, daysLeft, fetchVacancy, loadSaved, postedAgo, toggleSaved, Vacancy } from '../lib/vacancies';

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={[text.caption, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[text.bodyStrong, { color: colors.text, marginTop: 2 }]}>{value}</Text>
    </View>
  );
}

export default function VacancyDetailScreen({ route }: any) {
  const id: string = route.params.id;
  const [v, setV] = useState<Vacancy | null | undefined>(undefined);
  const [owner, setOwner] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      try {
        const vac = await fetchVacancy(id);
        setV(vac);
        if (vac) {
          Animated.timing(enter, { toValue: 1, duration: 500, useNativeDriver: true }).start();
          const { data } = await supabase.auth.getSession();
          const uid = data.session?.user?.id;
          if (uid) {
            setOwner(await canSeePostingDetail(vac, uid));
          }
          setSaved((await loadSaved()).includes(vac.id));
        }
      } catch (e: any) {
        setV(null);
        setError(e.message || 'Could not load this vacancy.');
      }
    })();
  }, [id, enter]);

  if (v === undefined) {
    return (
      <Screen>
        <Skeleton height={190} radius={24} />
        <Skeleton height={260} radius={20} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (!v) {
    return (
      <Screen>
        <Notice message={error} tone="error" />
        <EmptyState icon="info" title="Vacancy not found" message="This posting may have expired or been removed." />
      </Screen>
    );
  }

  const school = v.schools || {};
  const left = daysLeft(v);
  const link = v.apply_link || '';

  const share = async () => {
    try {
      await Share.open({ title: v.title, message: v.title + (school.name ? ' at ' + school.name : '') + (link ? '\nApply: ' + link : '') + '\nFound on Scholin', failOnCancel: false });
    } catch {}
  };

  const slide = { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }] };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.hero, slide]}>
          <View style={styles.orb} />
          <View style={styles.heroTop}>
            <SchoolMark name={school.name || 'Scholin'} uri={school.logo_url} size={60} />
            <View style={{ flex: 1 }}>
              <Text style={styles.heroSchool} numberOfLines={2}>{school.name || 'Scholin'}</Text>
              <Text style={styles.heroPosted}>{'Posted ' + postedAgo(v.created_at)}</Text>
            </View>
          </View>
          <Text style={styles.heroTitle}>{v.title}</Text>
          <View style={styles.pills}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{left <= 1 ? 'Closes today' : 'Closes in ' + left + ' days'}</Text>
            </View>
            {link ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>Apply online</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

        <Animated.View style={slide}>
          <View style={styles.actions}>
            <PressableScale onPress={async () => setSaved((await toggleSaved(v.id)).includes(v.id))} style={[styles.action, saved && { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.actionText, saved && { color: colors.primary }]}>{saved ? 'Saved' : 'Save job'}</Text>
            </PressableScale>
            <PressableScale onPress={share} style={styles.action}>
              <Text style={styles.actionText}>Share</Text>
            </PressableScale>
          </View>

          <View style={styles.card}>
            <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>About the role</Text>
            <LinkedText value={v.description} style={[text.body, { color: colors.text, lineHeight: 23 }]} />
            {!link ? (
              <View style={styles.noLink}>
                <Text style={[text.small, { color: colors.textMuted }]}>This posting has no application link. See the description for how to reach the poster.</Text>
              </View>
            ) : null}
          </View>

          <AdSlot />

          {owner ? (
            <View style={styles.card}>
              <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Posting details</Text>
              <View style={styles.facts}>
                <Fact label="Posted" value={new Date(v.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
                <Fact label="Time remaining" value={left + (left === 1 ? ' day' : ' days')} />
              </View>
            </View>
          ) : null}

          {school.name && (school.address || school.phone || school.email) ? (
            <View style={styles.card}>
              <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>About the school</Text>
              {school.address ? <Text style={[text.body, { color: colors.text, marginBottom: spacing.sm }]}>{school.address}</Text> : null}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm }}>
                {school.phone ? <Button title="Call" variant="soft" onPress={() => Linking.openURL('tel:' + school.phone)} style={{ flex: 1 }} /> : null}
                {school.email ? <Button title="Email" variant="soft" onPress={() => Linking.openURL('mailto:' + school.email)} style={{ flex: 1 }} /> : null}
              </View>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      {link ? (
        <View style={styles.bar}>
          <ShineButton title="Apply now" icon="send" onPress={() => Linking.openURL(link).catch(() => {})} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 130 },
  hero: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl, overflow: 'hidden' },
  orb: { position: 'absolute', right: -50, top: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.10)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroSchool: { color: '#FFFFFF', fontSize: 15, fontFamily: fonts.semibold },
  heroPosted: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, marginTop: 2, fontFamily: fonts.body },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 31, marginTop: spacing.lg, fontFamily: fonts.headingBold },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.lg },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)' },
  pillText: { color: '#FFFFFF', fontSize: 12.5, fontFamily: fonts.semibold },
  actions: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.lg },
  action: { flex: 1, height: 46, borderRadius: radius.lg, backgroundColor: '#EEF1F6', alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14.5, color: colors.text, fontFamily: fonts.semibold },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: '#EEF1F6' },
  noLink: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: '#F4F6FA' },
  facts: { flexDirection: 'row', gap: spacing.md },
  fact: { flex: 1, backgroundColor: '#F4F6FA', borderRadius: radius.md, padding: spacing.md },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
