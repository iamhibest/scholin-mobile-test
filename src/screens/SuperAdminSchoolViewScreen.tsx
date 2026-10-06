import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Button, Icon, Screen, Skeleton } from '../components';
import { IconName } from '../components/Icon';
import { colors, radius, spacing, text } from '../theme';
import { getSchoolAccessStatus } from '../lib/dashboard';
import { enterSchoolView, exitSchoolView } from '../lib/schoolView';
import { fetchSchoolCounts, fetchSchoolFull, fetchSchoolOwner } from '../lib/superAdmin';

const TILES: { label: string; desc: string; icon: IconName; route: string }[] = [
  { label: 'School overview', desc: 'Health, attendance, academics', icon: 'building', route: 'SchoolOverview' },
  { label: 'School portal', desc: 'Classes, results, report cards', icon: 'school', route: 'Portal' },
  { label: 'Teachers and roles', desc: 'Staff and permissions', icon: 'userCog', route: 'Teachers' },
  { label: 'Students', desc: 'View and edit records', icon: 'cap', route: 'Students' },
  { label: 'Subjects', desc: 'The subject list', icon: 'book', route: 'Subjects' },
  { label: 'Sessions and terms', desc: 'Academic sessions', icon: 'calendar', route: 'SessionsTerms' },
  { label: 'School settings', desc: 'Branding, grading, display', icon: 'settings', route: 'SchoolSettings' },
  { label: 'Staff attendance', desc: 'Clock ins at this school', icon: 'checklist', route: 'StaffAttendance' },
  { label: 'Student attendance', desc: 'Daily registers', icon: 'clipboard', route: 'StudentAttendance' },
  { label: 'QR codes', desc: 'Attendance points', icon: 'qr', route: 'QrCodes' },
  { label: 'Events and fees', desc: 'Fees and payments', icon: 'receipt', route: 'Events' },
  { label: 'Announcements', desc: 'Posts to this school', icon: 'megaphone', route: 'AdminAnnouncements' },
];

const STATE: Record<string, { label: string; color: string }> = {
  subscribed: { label: 'Active subscription', color: colors.success },
  trial: { label: 'On free trial', color: colors.accentDark },
  cancelled: { label: 'Subscription cancelled', color: colors.danger },
  expired: { label: 'Access expired', color: colors.danger },
};

export default function SuperAdminSchoolViewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const schoolId: string = route.params.schoolId;
  const [school, setSchool] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [counts, setCounts] = useState<{ staff: number; pending: number; students: number } | null>(null);
  const [error, setError] = useState('');
  const entered = useRef(false);

  // Switch every staff screen over to this school before any of them opens, and switch back when leaving.
  if (!entered.current) {
    enterSchoolView(schoolId);
    entered.current = true;
  }
  useEffect(() => {
    enterSchoolView(schoolId);
    return () => exitSchoolView();
  }, [schoolId]);

  const load = useCallback(async () => {
    try {
      setSchool(await fetchSchoolFull(schoolId));
      setOwner(await fetchSchoolOwner(schoolId));
      setCounts(await fetchSchoolCounts(schoolId));
    } catch (e: any) {
      setError(e && e.message ? e.message : 'Could not load this school.');
    }
  }, [schoolId]);

  useFocusEffect(
    useCallback(() => {
      enterSchoolView(schoolId);
      load();
    }, [load, schoolId]),
  );

  if (error) {
    return (
      <Screen>
        <Text style={[text.body, { color: colors.danger }]}>{error}</Text>
      </Screen>
    );
  }
  if (!school) {
    return (
      <Screen>
        <Skeleton height={200} radius={24} />
      </Screen>
    );
  }

  const status: any = getSchoolAccessStatus(school);
  const state = school.subscription_cancelled_at ? STATE.cancelled : STATE[status.reason] || STATE.expired;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={[text.h2, { color: colors.text }]}>{school.name}</Text>
          {school.address ? <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>{school.address}</Text> : null}
          <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>
            {[school.phone, school.email].filter(Boolean).join('  ·  ') || 'No contact details'}
          </Text>
          <Text style={[styles.state, { color: state.color, borderColor: state.color }]}>{state.label}</Text>
          <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.sm }]}>
            {owner && owner.profiles ? 'Owner: ' + owner.profiles.full_name + ' (' + owner.profiles.email + ')' : 'No owner found'}
          </Text>
        </View>

        {counts ? (
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={[text.h3, { color: colors.text }]}>{String(counts.staff)}</Text>
              <Text style={[text.caption, { color: colors.textMuted }]}>Staff</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[text.h3, { color: colors.text }]}>{String(counts.students)}</Text>
              <Text style={[text.caption, { color: colors.textMuted }]}>Students</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[text.h3, { color: counts.pending ? colors.accentDark : colors.text }]}>{String(counts.pending)}</Text>
              <Text style={[text.caption, { color: colors.textMuted }]}>Waiting</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.notice}>
          <Icon name="shieldCheck" size={18} color={colors.primary} />
          <Text style={[text.small, { color: colors.text, flex: 1 }]}>
            You are viewing this school as super admin. Anything you change is saved to this school. Go back to leave.
          </Text>
        </View>

        <View style={styles.grid}>
          {TILES.map(t => (
            <Pressable key={t.route} onPress={() => navigation.navigate(t.route)} style={styles.tile}>
              <View style={styles.tileIcon}>
                <Icon name={t.icon} size={20} color={colors.primary} />
              </View>
              <Text style={[text.bodyStrong, { color: colors.text, marginTop: spacing.sm }]} numberOfLines={2}>{t.label}</Text>
              <Text style={[text.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={2}>{t.desc}</Text>
            </Pressable>
          ))}
        </View>

        <Button title="Manage school, subscription and payments" variant="outline" onPress={() => navigation.navigate('SuperAdminSchool', { schoolId, name: school.name })} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  hero: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  state: { alignSelf: 'flex-start', marginTop: spacing.md, fontSize: 11, fontWeight: '700', borderWidth: 1, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, overflow: 'hidden' },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 18, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: 16, padding: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { width: '47.5%', flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  tileIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
