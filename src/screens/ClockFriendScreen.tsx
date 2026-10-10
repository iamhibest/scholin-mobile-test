import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { useFocusEffect } from '@react-navigation/native';
import { Button, EmptyState, Icon, Notice, PressableScale, Screen, SearchBar, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { getSchoolAccessStatus } from '../lib/dashboard';
import { parseQr, submitClock } from '../lib/attendance';
import { fetchClockTargets } from '../lib/staffTools';
import { ensureLocationPermission, flowStyles as styles, getBestLocation } from './ClockScreen';

type Target = { profileId: string; name: string; action: 'clock_in' | 'clock_out' | null };
type Step = 'face' | 'surroundings' | 'qr' | 'verifying' | 'result';

function Flow({ target, schoolId, onClose, onDone }: { target: Target; schoolId: string; onClose: () => void; onDone: () => void }) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const front = useCameraDevice('front');
  const back = useCameraDevice('back');
  const camera = useRef<Camera>(null);
  const [step, setStep] = useState<Step>('face');
  const [progress, setProgress] = useState('Getting a precise location fix');
  const [error, setError] = useState('');
  const [data, setData] = useState<any>(null);
  const handled = useRef(false);
  const action = target.action as 'clock_in' | 'clock_out';

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  const shoot = async (next: Step) => {
    try {
      await camera.current?.takePhoto({ flash: 'off' });
      setStep(next);
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
        if (!(await ensureLocationPermission())) {
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
          target_user_id: target.profileId,
          proxy_face_verified: true,
        });
        setData(result);
        setError('');
      } catch (e: any) {
        setError(e.message || 'Attendance could not be verified.');
      }
      setStep('result');
    },
    [action, schoolId, target.profileId],
  );

  const scanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: codes => {
      const v = codes[0] && codes[0].value;
      if (v) {
        onCode(v);
      }
    },
  });

  const close = () => {
    if (data) {
      onDone();
    }
    onClose();
  };

  const device = step === 'face' ? front : back;
  const showCamera = (step === 'face' || step === 'surroundings' || step === 'qr') && hasPermission && !!device;

  return (
    <Modal visible animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={styles.flow}>
        {showCamera ? <Camera key={step === 'face' ? 'front' : 'back'} ref={camera} style={StyleSheet.absoluteFill} device={device as any} isActive photo codeScanner={step === 'qr' ? scanner : undefined} /> : null}
        <SafeAreaView style={styles.flowTop} edges={['top']}>
          <Pressable onPress={close} style={styles.close} hitSlop={10}>
            <Icon name="close" size={22} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.flowTitle}>{(action === 'clock_in' ? 'Clock in ' : 'Clock out ') + target.name}</Text>
          <View style={{ width: 40 }} />
        </SafeAreaView>

        {(step === 'face' || step === 'surroundings' || step === 'qr') && !hasPermission ? (
          <View style={styles.center}>
            <Text style={styles.centerText}>Camera access is needed to clock a colleague.</Text>
            <Button title="Allow camera" onPress={requestPermission} style={{ marginTop: spacing.lg, alignSelf: 'stretch' }} />
          </View>
        ) : null}

        {step === 'face' && hasPermission ? (
          <View style={styles.bottom}>
            <Text style={styles.hint}>{'Step 1 of 3. Point the camera at ' + target.name + "'s face to confirm they are here in person."}</Text>
            <Pressable onPress={() => shoot('surroundings')} style={styles.shutter}>
              <View style={styles.shutterInner} />
            </Pressable>
          </View>
        ) : null}

        {step === 'surroundings' && hasPermission ? (
          <View style={styles.bottom}>
            <Text style={styles.hint}>Step 2 of 3. Take a live photo that shows your surroundings.</Text>
            <Pressable onPress={() => shoot('qr')} style={styles.shutter}>
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
              <Text style={styles.hint}>Step 3 of 3. Point the camera at your school's attendance QR code.</Text>
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
                <Text style={styles.resultTitle}>{target.name + (data && data.status === 'late' ? ' is late' : ' is present')}</Text>
                <Text style={styles.centerText}>{'Clocked in at ' + (data ? data.time : '') + '\nFace, QR, location and surroundings verified'}</Text>
              </>
            ) : (
              <>
                <Text style={styles.resultTitle}>{target.name + ' clocked out'}</Text>
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

export default function ClockFriendScreen() {
  const { ctx, loading: ctxLoading } = useStaff();
  const [list, setList] = useState<Target[] | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Target | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      setError('');
      setList(await fetchClockTargets(ctx.schoolId, ctx.userId));
    } catch (e: any) {
      setList([]);
      setError(e.message);
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (list || []).filter(t => !q || t.name.toLowerCase().includes(q));
  }, [list, query]);

  if (ctxLoading || (ctx && list === null)) {
    return (
      <Screen>
        <Skeleton height={50} radius={25} />
        <Skeleton height={70} radius={18} style={{ marginTop: spacing.lg }} />
        <Skeleton height={70} radius={18} style={{ marginTop: spacing.md }} />
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

  return (
    <Screen padded={false}>
      <FlatList renderScrollComponent={(sp: any) => <ScrollView {...sp} />}
        data={shown}
        keyExtractor={t => t.profileId}
        contentContainerStyle={local.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.md }}>
            <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>Help a colleague clock in or out, for example when their phone battery is low.</Text>
            <SearchBar value={query} onChange={setQuery} placeholder="Search teacher by name" />
            <Notice message={error} tone="error" />
          </View>
        }
        ListEmptyComponent={<EmptyState icon="users" title="No teachers found" message="There is nobody else to clock right now." />}
        renderItem={({ item }) => {
          const done = item.action === null;
          return (
            <PressableScale disabled={done} onPress={() => setPicked(item)} style={[local.row, done && { opacity: 0.55 }]}>
              <View style={[local.dot, { backgroundColor: done ? colors.success : item.action === 'clock_out' ? colors.primary : colors.textMuted }]} />
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[text.small, { color: item.action === 'clock_out' ? colors.primary : colors.textMuted }]}>{done ? 'Complete for today' : item.action === 'clock_out' ? 'Clocked in, needs clock out' : 'Not clocked in'}</Text>
              </View>
              {!done ? <Text style={[text.small, { color: colors.primary, fontFamily: fonts.semibold }]}>{item.action === 'clock_out' ? 'Clock out' : 'Clock in'}</Text> : null}
            </PressableScale>
          );
        }}
      />
      {picked && ctx ? <Flow target={picked} schoolId={ctx.schoolId} onClose={() => setPicked(null)} onDone={load} /> : null}
    </Screen>
  );
}

const local = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: '#EEF1F6' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
