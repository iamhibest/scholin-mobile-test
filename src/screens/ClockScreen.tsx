import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import Geolocation from 'react-native-geolocation-service';
import { Badge, Button, Card, EmptyState, Icon, Screen, Skeleton } from '../components';
import { IconName } from '../components/Icon';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { getSchoolAccessStatus } from '../lib/dashboard';
import { fetchTodayRecord, hoursLabel, parseQr, submitClock, timeLabel } from '../lib/attendance';

type Action = 'clock_in' | 'clock_out';
type Step = 'photo' | 'qr' | 'verifying' | 'result';

export function getBestLocation(onProgress: (text: string) => void): Promise<{ latitude: number; longitude: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    let best: any = null;
    let finished = false;
    let watchId: number | null = null;
    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
      }
      if (!best) {
        reject(new Error('Could not get your location. Please enable GPS, step outside if possible, and try again.'));
      } else {
        resolve({ latitude: best.coords.latitude, longitude: best.coords.longitude, accuracy: best.coords.accuracy });
      }
    };
    watchId = Geolocation.watchPosition(
      pos => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) {
          best = pos;
          onProgress('Location accuracy ' + Math.round(pos.coords.accuracy) + ' meters');
        }
        if (pos.coords.accuracy <= 20) {
          finish();
        }
      },
      () => {},
      { enableHighAccuracy: true, interval: 1000, fastestInterval: 500, distanceFilter: 0 },
    );
    setTimeout(finish, 10000);
  });
}

export async function ensureLocationPermission() {
  if (Platform.OS !== 'android') {
    return true;
  }
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

function ClockFlow({ visible, action, schoolId, onClose, onDone }: { visible: boolean; action: Action; schoolId: string; onClose: () => void; onDone: () => void }) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  const [step, setStep] = useState<Step>('photo');
  const [verified, setVerified] = useState(false);
  const [progress, setProgress] = useState('Getting a precise location fix');
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (visible) {
      setStep('photo');
      setVerified(false);
      setError('');
      setData(null);
      handled.current = false;
      if (!hasPermission) {
        requestPermission();
      }
    }
  }, [visible]);

  const capture = async () => {
    try {
      await camera.current?.takePhoto({ flash: 'off' });
      setVerified(true);
      setStep('qr');
    } catch {
      setError('Could not take the photo. Please try again.');
      setStep('result');
    }
  };

  const onCode = useCallback(
    async (value: string) => {
      if (handled.current) {
        return;
      }
      handled.current = true;
      const parsed = parseQr(value);
      if (!parsed) {
        setError("Invalid QR code. Please scan your school's attendance QR code.");
        setStep('result');
        return;
      }
      if (parsed.schoolId !== schoolId) {
        setError('This QR code does not belong to your school.');
        setStep('result');
        return;
      }
      setStep('verifying');
      setProgress('Getting a precise location fix');
      try {
        const allowed = await ensureLocationPermission();
        if (!allowed) {
          throw new Error('Location permission is needed to verify you are at school.');
        }
        const pos = await getBestLocation(setProgress);
        setProgress('Recording attendance');
        const result = await submitClock({
          school_id: schoolId,
          attendance_point_id: parsed.pointId,
          qr_token: parsed.token,
          action,
          location_accuracy_meters: pos.accuracy,
          latitude: pos.latitude,
          longitude: pos.longitude,
          environment_verified: true,
        });
        setData(result);
        setError('');
      } catch (e: any) {
        setError(e.message || 'Attendance could not be verified.');
      }
      setStep('result');
    },
    [action, schoolId],
  );

  const scanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      const value = codes[0] && codes[0].value;
      if (value) {
        onCode(value);
      }
    },
  });

  const close = () => {
    if (data) {
      onDone();
    }
    onClose();
  };

  const showCamera = (step === 'photo' || step === 'qr') && hasPermission && !!device;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={styles.flow}>
        {showCamera ? (
          <Camera ref={camera} style={StyleSheet.absoluteFill} device={device as any} isActive={visible} photo={true} codeScanner={step === 'qr' ? scanner : undefined} />
        ) : null}
        <SafeAreaView style={styles.flowTop} edges={['top']}>
          <Pressable onPress={close} style={styles.close} hitSlop={10}>
            <Icon name="close" size={22} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.flowTitle}>{action === 'clock_in' ? 'Clock in' : 'Clock out'}</Text>
          <View style={{ width: 40 }} />
        </SafeAreaView>

        {(step === 'photo' || step === 'qr') && !hasPermission ? (
          <View style={styles.center}>
            <Text style={styles.centerText}>Camera access is needed to clock in and out.</Text>
            <Button title="Allow camera" onPress={requestPermission} style={{ marginTop: spacing.lg, alignSelf: 'stretch' }} />
          </View>
        ) : null}

        {step === 'photo' && hasPermission ? (
          <View style={styles.bottom}>
            <Text style={styles.hint}>Step 1 of 2. Take a live photo that shows your surroundings.</Text>
            <Pressable onPress={capture} style={styles.shutter}>
              <View style={styles.shutterInner} />
            </Pressable>
          </View>
        ) : null}

        {step === 'qr' ? (
          <>
            <View style={styles.frameWrap} pointerEvents="none">
              <View style={styles.frame} />
            </View>
            <View style={styles.bottom}>
              <Text style={styles.hint}>Step 2 of 2. Point the camera at your school's attendance QR code.</Text>
            </View>
          </>
        ) : null}

        {step === 'verifying' ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={[styles.centerText, { marginTop: spacing.lg }]}>{progress}</Text>
          </View>
        ) : null}

        {step === 'result' ? (
          <View style={styles.center}>
            <View style={[styles.resultIcon, { backgroundColor: error ? colors.danger : colors.success }]}>
              <Icon name={error ? 'close' : 'check'} size={36} color="#FFFFFF" strokeWidth={2.6} />
            </View>
            {error ? (
              <>
                <Text style={styles.resultTitle}>Attendance failed</Text>
                <Text style={styles.centerText}>{error}</Text>
              </>
            ) : action === 'clock_in' ? (
              <>
                <Text style={styles.resultTitle}>{data && data.status === 'late' ? 'Late' : 'Present'}</Text>
                <Text style={styles.centerText}>{'Clocked in at ' + (data ? data.time : '')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.resultTitle}>Clocked out</Text>
                <Text style={styles.centerText}>{(data ? data.clockInTime + ' to ' + data.clockOutTime : '') + '\nTotal ' + (data ? data.totalHours : '')}</Text>
              </>
            )}
            <Button title={error ? 'Close' : 'Done'} onPress={close} style={{ marginTop: spacing.xl, alignSelf: 'stretch' }} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function Check({ icon, label, sub }: { icon: IconName; label: string; sub: string }) {
  return (
    <View style={styles.check}>
      <View style={styles.checkIcon}>
        <Icon name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={[text.caption, { color: colors.text, marginTop: 6 }]}>{label}</Text>
      <Text style={[text.caption, { color: colors.textMuted, textAlign: 'center' }]}>{sub}</Text>
    </View>
  );
}

export default function ClockScreen({ navigation }: any) {
  const { ctx, loading: ctxLoading } = useStaff();
  const [record, setRecord] = useState<any>(undefined);
  const [flow, setFlow] = useState<Action | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      setRecord(await fetchTodayRecord(ctx.schoolId, ctx.userId));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (ctxLoading || (record === undefined && !failed)) {
    return (
      <Screen>
        <Skeleton height={320} radius={28} />
      </Screen>
    );
  }

  if (ctx && !getSchoolAccessStatus(ctx.school).active) {
    return (
      <Screen>
        <EmptyState icon="lock" title="Subscription needed" message="Your school's access has ended. Ask the school owner to renew the subscription." />
      </Screen>
    );
  }

  if (failed || !ctx) {
    return (
      <Screen>
        <EmptyState icon="info" title="Could not load today's attendance" actionLabel="Try again" onAction={load} />
      </Screen>
    );
  }

  const today = new Date();
  const dateLabel = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()] + ', ' + today.getDate() + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][today.getMonth()];
  const clockedIn = record && record.clock_in_time;
  const clockedOut = record && record.clock_out_time;

  return (
    <Screen scroll>
      <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>{dateLabel}</Text>
      <Card style={styles.card}>
        <View style={[styles.circle, { backgroundColor: clockedOut ? colors.successSoft : clockedIn ? colors.primarySoft : colors.accentSoft }]}>
          <Icon name={clockedOut ? 'check' : clockedIn ? 'clock' : 'qr'} size={40} color={clockedOut ? colors.success : clockedIn ? colors.primary : colors.accentDark} />
        </View>

        {!clockedIn ? (
          <>
            <Text style={[text.h2, styles.title]}>You have not clocked in yet today</Text>
            <Text style={[text.body, styles.sub]}>Tap below to clock in and mark your attendance.</Text>
            <Button title="Clock in" icon="arrowRight" onPress={() => setFlow('clock_in')} style={styles.big} />
          </>
        ) : null}

        {clockedIn && !clockedOut ? (
          <>
            <Badge label={record.clock_in_status === 'late' ? 'Late' : 'Present'} tone={record.clock_in_status === 'late' ? 'orange' : 'green'} />
            <Text style={[text.caption, { color: colors.textMuted, marginTop: spacing.lg }]}>CLOCKED IN AT</Text>
            <Text style={styles.time}>{timeLabel(record.clock_in_time)}</Text>
            <Button title="Clock out" icon="arrowRight" variant="danger" onPress={() => setFlow('clock_out')} style={styles.big} />
          </>
        ) : null}

        {clockedOut ? (
          <>
            <Badge label="Complete for today" tone="green" />
            <View style={styles.times}>
              <View style={{ alignItems: 'center' }}>
                <Text style={[text.caption, { color: colors.textMuted }]}>CLOCK IN</Text>
                <Text style={styles.timeSmall}>{timeLabel(record.clock_in_time)}</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[text.caption, { color: colors.textMuted }]}>CLOCK OUT</Text>
                <Text style={styles.timeSmall}>{timeLabel(record.clock_out_time)}</Text>
              </View>
            </View>
            <Text style={[text.body, { color: colors.textMuted }]}>{'Total ' + hoursLabel(record.total_hours)}</Text>
          </>
        ) : null}

        <View style={styles.checks}>
          <Check icon="pin" label="GPS verified" sub="Within school radius" />
          <Check icon="scan" label="Photo required" sub="Shows your surroundings" />
          <Check icon="shield" label="Secure" sub="For school records" />
        </View>
      </Card>

      <Button title="Clock a friend" variant="soft" icon="users" onPress={() => navigation.navigate('ClockFriend')} style={{ marginTop: spacing.lg }} />

      {flow ? <ClockFlow visible action={flow} schoolId={ctx.schoolId} onClose={() => setFlow(null)} onDone={load} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: spacing.xl },
  circle: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  title: { color: colors.text, textAlign: 'center' },
  sub: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  big: { alignSelf: 'stretch', marginTop: spacing.xl },
  time: { fontFamily: fonts.headingBold, fontSize: 34, lineHeight: 42, color: colors.text },
  times: { flexDirection: 'row', gap: 48, marginVertical: spacing.lg },
  timeSmall: { fontFamily: fonts.headingBold, fontSize: 22, lineHeight: 30, color: colors.text, marginTop: 2 },
  checks: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, alignSelf: 'stretch' },
  check: { flex: 1, alignItems: 'center' },
  checkIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  flow: { flex: 1, backgroundColor: '#0B0F19' },
  flowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  flowTitle: { fontFamily: fonts.semibold, fontSize: 17, color: '#FFFFFF' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: 56, gap: spacing.lg },
  hint: { color: '#FFFFFF', textAlign: 'center', fontFamily: fonts.medium, fontSize: 15, lineHeight: 22, backgroundColor: 'rgba(0,0,0,0.55)', padding: spacing.md, borderRadius: radius.md, overflow: 'hidden' },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#FFFFFF' },
  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderRadius: 28, borderWidth: 3, borderColor: '#FFFFFF' },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  centerText: { color: '#FFFFFF', textAlign: 'center', fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  resultIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  resultTitle: { fontFamily: fonts.headingBold, fontSize: 28, lineHeight: 36, color: '#FFFFFF', marginBottom: spacing.sm },
});

export const flowStyles = styles;
