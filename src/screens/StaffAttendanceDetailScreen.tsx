import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { Card, EmptyState, Icon, Screen, Skeleton } from '../components';
import { colors, fonts, spacing, text } from '../theme';
import { fetchStaffRecord } from '../lib/admin';
import { hoursLabel, timeLabel } from '../lib/attendance';

function Check({ label, ok }: { label: string; ok: boolean }) {
  return (
    <View style={styles.check}>
      <View style={[styles.dot, { backgroundColor: ok ? colors.successSoft : colors.dangerSoft }]}>
        <Icon name={ok ? 'check' : 'close'} size={14} color={ok ? colors.success : colors.danger} strokeWidth={2.6} />
      </View>
      <Text style={[text.body, { color: ok ? colors.text : colors.danger }]}>{label}</Text>
    </View>
  );
}

export default function StaffAttendanceDetailScreen({ navigation, route }: any) {
  const { recordId } = route.params;
  const [r, setR] = useState<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Attendance record' });
    fetchStaffRecord(recordId).then(setR).catch(() => setFailed(true));
  }, [recordId, navigation]);

  if (failed) {
    return (
      <Screen>
        <EmptyState icon="info" title="Record not found" />
      </Screen>
    );
  }
  if (!r) {
    return (
      <Screen>
        <Skeleton height={260} radius={24} />
      </Screen>
    );
  }

  const dateLabel = new Date(r.date + 'T00:00:00').toDateString();

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[text.h2, { color: colors.text }]}>{r.profiles ? r.profiles.full_name : ''}</Text>
        <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>{(r.schools ? r.schools.name + '  |  ' : '') + dateLabel}</Text>
        <Card>
          <View style={styles.times}>
            <View style={{ alignItems: 'center' }}>
              <Text style={[text.caption, { color: colors.textMuted }]}>CLOCK IN</Text>
              <Text style={styles.time}>{r.clock_in_time ? timeLabel(r.clock_in_time) : '-'}</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text style={[text.caption, { color: colors.textMuted }]}>CLOCK OUT</Text>
              <Text style={styles.time}>{r.clock_out_time ? timeLabel(r.clock_out_time) : '-'}</Text>
            </View>
          </View>
          <Text style={[text.body, { color: colors.textMuted, textAlign: 'center' }]}>{'Total: ' + (r.total_hours !== null && r.total_hours !== undefined ? hoursLabel(r.total_hours) : '-')}</Text>
        </Card>

        {r.clock_in_time ? (
          <Card style={styles.block}>
            <Text style={[text.h3, { color: colors.text, marginBottom: spacing.sm }]}>Clock in verification</Text>
            <Check label="QR verified" ok={!!r.clock_in_qr_verified} />
            <Check label="GPS verified" ok={!!r.clock_in_location_verified} />
            <Check label="Environment verified" ok={!!r.clock_in_environment_verified} />
            {r.clock_in_proxy && r.clock_in_proxy.full_name ? <Text style={[text.small, { color: colors.primary, marginTop: spacing.sm }]}>{'Clocked in by ' + r.clock_in_proxy.full_name}</Text> : null}
          </Card>
        ) : null}

        {r.clock_out_time ? (
          <Card style={styles.block}>
            <Text style={[text.h3, { color: colors.text, marginBottom: spacing.sm }]}>Clock out verification</Text>
            <Check label="QR verified" ok={!!r.clock_out_qr_verified} />
            <Check label="GPS verified" ok={!!r.clock_out_location_verified} />
            <Check label="Environment verified" ok={!!r.clock_out_environment_verified} />
            {r.clock_out_proxy && r.clock_out_proxy.full_name ? <Text style={[text.small, { color: colors.primary, marginTop: spacing.sm }]}>{'Clocked out by ' + r.clock_out_proxy.full_name}</Text> : null}
          </Card>
        ) : null}

      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  times: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.md },
  time: { fontFamily: fonts.headingBold, fontSize: 24, lineHeight: 32, color: colors.text, marginTop: 2 },
  block: { marginTop: spacing.lg },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 6 },
  dot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
