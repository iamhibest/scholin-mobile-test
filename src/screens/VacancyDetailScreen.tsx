import React, { useEffect, useRef, useState } from 'react';
import { Animated, Linking, StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import Share from 'react-native-share';
import { AdSlot, Button, EmptyState, Icon, LinkedText, Notice, PressableScale, Screen, ShineButton, Skeleton } from '../components';
import { VGREEN } from '../components/JobCard';
import { colors, fonts, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { canSeePostingDetail, categoryLabel, daysLeft, deadlineLabel, fetchVacancy, jobTypeLabel, loadSaved, postedAgo, posterOf, toggleSaved, Vacancy } from '../lib/vacancies';

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
  const poster = posterOf(v);
  const contact = v.profiles || {};
  const left = daysLeft(v);
  const link = v.apply_link || '';

  const share = async () => {
    try {
      await Share.open({ title: v.title, message: v.title + (!poster.personal && poster.name ? ' at ' + poster.name : '') + (v.location ? ', ' + v.location : '') + (link ? '\nApply: ' + link : '') + '\nFound on Scholin', failOnCancel: false });
    } catch {}
  };

  const slide = { opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }] };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.hero, slide]}>
          <View style={styles.orb} />
          <View style={styles.catPill}>
            <Text style={styles.catText} numberOfLines={1}>{categoryLabel(v.category)}</Text>
          </View>
          <Text style={styles.heroTitle}>{v.title}</Text>
          {!poster.personal ? <Text style={styles.heroSchool} numberOfLines={2}>{poster.name}</Text> : null}
          {poster.person ? <Text style={styles.heroPosted} numberOfLines={1}>{'Posted by ' + poster.person}</Text> : null}
          <View style={styles.metaRow}>
            {v.location ? (
              <View style={styles.metaItem}>
                <Icon name="pin" size={15} color={VGREEN.mid} />
                <Text style={styles.metaText} numberOfLines={2}>{v.location}</Text>
              </View>
            ) : null}
            <Text style={styles.metaText}>{jobTypeLabel(v.job_type)}</Text>
          </View>
          <View style={styles.pills}>
            <View style={styles.pill}>
              <Text style={styles.pillText} numberOfLines={1}>{(left <= 1 ? 'Closes today' : 'Closes in ' + left + ' days') + '  |  ' + deadlineLabel(v)}</Text>
            </View>
            {link ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>Apply online</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.ago}>{'Posted ' + postedAgo(v.created_at)}</Text>
        </Animated.View>

        <Animated.View style={slide}>
          <View style={styles.actions}>
            <PressableScale onPress={async () => setSaved((await toggleSaved(v.id)).includes(v.id))} style={[styles.action, saved && { backgroundColor: VGREEN.pill }]}>
              <Text style={[styles.actionText, saved && { color: VGREEN.dark }]}>{saved ? 'Saved' : 'Save job'}</Text>
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

          {!poster.personal && school.address ? (
            <View style={styles.card}>
              <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>About the school</Text>
              <Text style={[text.body, { color: colors.text }]}>{school.address}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={[text.h3, { color: colors.text }]}>Message the poster</Text>
            <Text style={[text.small, { color: colors.textMuted, marginTop: 2, marginBottom: spacing.md }]}>
              {(poster.person || 'The poster') + (poster.personal ? ' posted this vacancy personally.' : ' posted this vacancy.')}
            </Text>
            {contact.phone || contact.email ? (
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                {contact.phone ? <Button title="Call" variant="soft" onPress={() => Linking.openURL('tel:' + contact.phone)} style={{ flex: 1 }} /> : null}
                {contact.email ? <Button title="Email" variant="soft" onPress={() => Linking.openURL('mailto:' + contact.email)} style={{ flex: 1 }} /> : null}
              </View>
            ) : (
              <Text style={[text.small, { color: colors.textMuted }]}>The poster has not shared a phone number or email address.</Text>
            )}
          </View>
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
  hero: { backgroundColor: VGREEN.soft, borderRadius: radius.xl, padding: spacing.xl, overflow: 'hidden', borderWidth: 1, borderColor: '#D6E8DC' },
  orb: { position: 'absolute', right: -50, top: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: '#D5E8DB' },
  catPill: { alignSelf: 'flex-start', backgroundColor: VGREEN.dark, paddingHorizontal: 14, height: 30, borderRadius: radius.pill, justifyContent: 'center' },
  catText: { color: '#FFFFFF', fontSize: 12.5, fontFamily: fonts.semibold },
  heroTitle: { color: VGREEN.ink, fontSize: 26, lineHeight: 33, marginTop: spacing.md, fontFamily: fonts.headingBold },
  heroSchool: { color: VGREEN.mid, fontSize: 16, marginTop: 4, fontFamily: fonts.semibold },
  heroPosted: { color: colors.textMuted, fontSize: 13.5, marginTop: 2, fontFamily: fonts.body },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.lg, rowGap: 4, marginTop: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { color: '#3F4B45', fontSize: 14, fontFamily: fonts.medium, flexShrink: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  pill: { paddingHorizontal: 12, height: 32, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: VGREEN.pill },
  pillText: { color: VGREEN.mid, fontSize: 12.5, fontFamily: fonts.semibold },
  ago: { color: colors.textMuted, fontSize: 12.5, marginTop: spacing.md, fontFamily: fonts.body },
  actions: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.lg },
  action: { flex: 1, height: 46, borderRadius: radius.pill, backgroundColor: '#EEF1EF', alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14.5, color: colors.text, fontFamily: fonts.semibold },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: '#E6ECE8' },
  noLink: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: '#F2F6F3' },
  facts: { flexDirection: 'row', gap: spacing.md },
  fact: { flex: 1, backgroundColor: '#F2F6F3', borderRadius: radius.md, padding: spacing.md },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
