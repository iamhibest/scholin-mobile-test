import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import QRCode from 'react-native-qrcode-svg';
import Geolocation from 'react-native-geolocation-service';
import { Badge, Button, Card, EmptyState, Icon, Input, Notice, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { useChain } from '../lib/useChain';
import { confirmAction } from '../lib/confirm';
import { buildQrPosterHtml } from '../lib/qrPoster';
import { createPoint, deletePoint, fetchPoints, setPointActive } from '../lib/admin';

function currentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise(async (resolve, reject) => {
    if (Platform.OS === 'android') {
      const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      if (g !== PermissionsAndroid.RESULTS.GRANTED) {
        reject(new Error('Location permission is needed to place the attendance point.'));
        return;
      }
    }
    Geolocation.getCurrentPosition(
      p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => reject(new Error('Could not get your location. Please enable GPS and make sure you are standing at the attendance point, then try again.')),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  });
}

export default function QrCodesScreen({ navigation }: any) {
  const { ctx, loading: ctxLoading } = useStaff();
  const chain = useChain(2);
  const [points, setPoints] = useState<any[] | null>(null);
  const [name, setName] = useState('');
  const [radius, setRadius] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });
  const refs = useRef<Record<string, any>>({});

  const canManage = !!ctx && (ctx.role === 'owner' || (ctx.role === 'teacher_admin' && ctx.membership.can_manage_qr_codes === true));

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      setPoints(await fetchPoints(ctx.schoolId));
    } catch (e: any) {
      setPoints([]);
      setNotice({ message: e.message, tone: 'error' });
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const add = async () => {
    if (!ctx) {
      return;
    }
    if (!name.trim()) {
      setNotice({ message: 'Please enter a name for this attendance point.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const pos = await currentPosition();
      await createPoint(ctx.schoolId, name.trim(), pos.latitude, pos.longitude, radius ? parseInt(radius, 10) : null);
      setName('');
      setRadius('');
      setNotice({ message: 'Attendance point created at your current location.', tone: 'success' });
      await load();
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy(false);
  };

  const openPoster = (p: any) => {
    try {
      const html = buildQrPosterHtml({
        schoolName: ctx ? ctx.school.name : '',
        address: ctx ? ctx.school.address || '' : '',
        pointName: p.name,
        logoUrl: ctx ? ctx.school.logo_url : null,
        qrValue: 'SCHOLIN-ATTEND:' + ctx!.schoolId + ':' + p.id + ':' + p.qr_token,
      });
      navigation.navigate('QrPoster', { html, name: p.name });
    } catch (e: any) {
      setNotice({ message: e && e.message ? e.message : 'Could not build the poster.', tone: 'error' });
    }
  };

  const toggle = (p: any) => {
    const verb = p.is_active ? 'deactivate' : 'reactivate';
    confirmAction('Are you sure?', 'Are you sure you want to ' + verb + ' this attendance point?', verb.charAt(0).toUpperCase() + verb.slice(1), async () => {
      try {
        await setPointActive(p.id, !p.is_active);
        await load();
      } catch (e: any) {
        setNotice({ message: e.message, tone: 'error' });
      }
    }, false);
  };

  const remove = (p: any) => {
    confirmAction('Delete QR code', 'Permanently delete the QR code for "' + p.name + '"? Anyone with the printed or downloaded code will no longer be able to clock in or out with it. Past attendance records are not affected.', 'Delete', async () => {
      try {
        await deletePoint(p.id);
        await load();
      } catch (e: any) {
        setNotice({ message: e.message, tone: 'error' });
      }
    });
  };

  if (ctxLoading || !points) {
    return (
      <Screen>
        <Skeleton height={260} radius={24} />
      </Screen>
    );
  }

  if (ctx && !(ctx.role === 'owner' || ctx.role === 'teacher_admin')) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Admins only" message="Only the school owner and teacher admins can see attendance QR codes." />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>Permanent QR codes for each attendance point. Print one and put it where staff clock in.</Text>
        <Notice message={notice.message} tone={notice.tone} />

        {canManage ? (
          <Card style={{ marginBottom: spacing.xl }}>
            <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Add attendance point</Text>
            <Input {...chain(0)} label="Name" value={name} onChangeText={setName} placeholder="e.g. Main Gate" icon="pin" autoCapitalize="words" />
            <Input {...chain(1)} label="Radius in meters (optional)" value={radius} onChangeText={setRadius} placeholder="Uses the school radius if empty" keyboardType="number-pad" />
            <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>Stand at the attendance point when you tap the button. Its location is taken from your phone.</Text>
            <Button title="Create at my location" icon="pin" loading={busy} onPress={add} />
          </Card>
        ) : (
          <Notice message="You do not have permission to manage QR codes. Ask the school owner to turn it on in Teachers and Roles." tone="error" />
        )}

        {points.length === 0 ? <EmptyState icon="qr" title="No attendance points yet" message="Add one above to generate its permanent QR code." /> : null}

        {points.map(p => (
          <Card key={p.id} style={[styles.point, !p.is_active && { opacity: 0.6 }]}>
            <View style={styles.head}>
              <Text style={[text.h3, { color: colors.text, flex: 1 }]}>{p.name}</Text>
              {!p.is_active ? <Badge label="Deactivated" tone="orange" /> : null}
            </View>
            <Text style={[text.small, { color: colors.textMuted }]}>{'QR ID: ' + String(p.id).slice(0, 8).toUpperCase()}</Text>
            <View style={styles.qrRow}>
              <View style={styles.qr}>
                <QRCode
                  value={'SCHOLIN-ATTEND:' + ctx!.schoolId + ':' + p.id + ':' + p.qr_token}
                  size={104}
                  backgroundColor="#FFFFFF"
                  getRef={(c: any) => {
                    refs.current[p.id] = c;
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.sm }]}>Tap the button to see the poster. From there you can print it, share it or save it.</Text>
                <Button title="Print or share poster" icon="send" onPress={() => openPoster(p)} style={{ height: 46 }} />
              </View>
            </View>
            {canManage ? (
              <View style={styles.actions}>
                <Button title={p.is_active ? 'Deactivate' : 'Reactivate'} variant="soft" style={styles.action} onPress={() => toggle(p)} />
                <Button title="Delete" icon="trash" variant="danger" style={styles.action} onPress={() => remove(p)} />
              </View>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  point: { marginBottom: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qrRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginVertical: spacing.md },
  qr: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: colors.border },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  action: { flex: 1, height: 44, paddingHorizontal: 8 },
});
