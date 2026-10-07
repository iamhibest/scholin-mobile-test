import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { colors, radius, spacing, text } from '../theme';
import { isOnline, noteTouch, onOfflineDialog, onOnlineChange, recheck } from '../lib/network';

// Wraps the whole app: a small "You are offline" note at the top, and a dialog when someone taps something that needs internet.
export default function OfflineLayer({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [online, setOnline] = useState(isOnline());
  const [dialog, setDialog] = useState(false);
  const [checking, setChecking] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => onOnlineChange(setOnline), []);
  useEffect(
    () =>
      onOfflineDialog(() => {
        setStill(false);
        setDialog(true);
      }),
    [],
  );
  useEffect(() => {
    if (online) {
      setDialog(false);
    }
  }, [online]);

  const reconnect = async () => {
    setChecking(true);
    setStill(false);
    const ok = await recheck();
    setChecking(false);
    if (ok) {
      setDialog(false);
    } else {
      setStill(true);
    }
  };

  return (
    <View style={{ flex: 1 }} onStartShouldSetResponderCapture={() => { noteTouch(); return false; }}>
      {children}
      {!online ? (
        <View pointerEvents="none" style={[styles.note, { top: insets.top + 6 }]}>
          <View style={styles.noteDot} />
          <Text style={styles.noteText}>You are offline</Text>
        </View>
      ) : null}
      <Modal visible={dialog} transparent animationType="fade" onRequestClose={() => setDialog(false)} statusBarTranslucent>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDialog(false)} />
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <WifiOff size={26} color={colors.danger} />
            </View>
            <Text style={[text.h3, styles.title]}>You are not connected to the internet</Text>
            <Text style={[text.small, styles.sub]}>{still ? 'Still offline. Check your connection and try again.' : 'Check your connection and try again.'}</Text>
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.cancel]} onPress={() => setDialog(false)}>
                <Text style={[text.bodyStrong, { color: colors.text }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.primary]} onPress={reconnect} disabled={checking}>
                {checking ? <ActivityIndicator color="#FFFFFF" /> : <Text style={[text.bodyStrong, { color: '#FFFFFF' }]}>Reconnect</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  note: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1F2937', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, zIndex: 50, elevation: 12 },
  noteDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F59E0B' },
  noteText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center' },
  iconWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, textAlign: 'center', marginTop: spacing.lg },
  sub: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, width: '100%' },
  btn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancel: { backgroundColor: '#F3F4F6' },
  primary: { backgroundColor: colors.primary },
});
