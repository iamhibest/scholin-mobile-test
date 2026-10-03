import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Icon } from '../components';
import { colors, spacing, text } from '../theme';
import { PayKind, readPaymentStatus, verifyPayment } from '../lib/payments';

type Phase = 'paying' | 'checking' | 'paid' | 'pending';

// Shows the checkout page the server gave us and watches for the result. The
// server confirms the payment itself (webhook), so this screen only waits for
// the confirmed status and never decides on its own that a payment worked.
export default function PaymentCheckoutScreen({ navigation, route }: any) {
  const { kind, url, reference, paymentId, amountLabel } = route.params as { kind: PayKind; url: string; reference: string; paymentId: string; amountLabel?: string };
  const [phase, setPhase] = useState<Phase>('paying');
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const done = useRef(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Secure payment', headerBackVisible: false, gestureEnabled: false });
  }, [navigation]);

  const markPaid = useCallback(() => {
    if (!done.current) {
      done.current = true;
      setPhase('paid');
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (done.current) {
        return;
      }
      try {
        if ((await readPaymentStatus(kind, paymentId)) === 'paid') {
          markPaid();
        }
      } catch {}
    }, 3000);
    return () => clearInterval(timer);
  }, [kind, paymentId, markPaid]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const finish = async () => {
    setPhase('checking');
    setNote('');
    try {
      await verifyPayment(kind, reference, paymentId);
      markPaid();
    } catch (e: any) {
      if ((await readPaymentStatus(kind, paymentId).catch(() => null)) === 'paid') {
        markPaid();
        return;
      }
      setNote(e.message);
      setPhase('pending');
    }
  };

  const leave = () => navigation.goBack();

  if (phase === 'paid') {
    return (
      <SafeAreaView style={styles.center} edges={['bottom']}>
        <View style={styles.badge}>
          <Icon name="check" size={34} color="#FFFFFF" />
        </View>
        <Text style={[text.h3, styles.title]}>Payment confirmed</Text>
        <Text style={[text.body, styles.muted]}>Thank you. Your payment has been received and confirmed.</Text>
        <Button title="Done" onPress={leave} style={{ marginTop: spacing.xl, alignSelf: 'stretch' }} />
      </SafeAreaView>
    );
  }

  if (phase === 'checking') {
    return (
      <SafeAreaView style={styles.center} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[text.body, styles.muted, { marginTop: spacing.lg }]}>Confirming your payment</Text>
      </SafeAreaView>
    );
  }

  if (phase === 'pending') {
    return (
      <SafeAreaView style={styles.center} edges={['bottom']}>
        <Text style={[text.h3, styles.title]}>Not confirmed yet</Text>
        <Text style={[text.body, styles.muted]}>{note || 'We have not received a confirmation for this payment yet.'}</Text>
        <Text style={[text.small, styles.muted, { marginTop: spacing.sm }]}>If you already paid, wait a moment and check again. Your payment stays saved as pending until it is confirmed.</Text>
        <Button title="Check again" onPress={finish} style={{ marginTop: spacing.xl, alignSelf: 'stretch' }} />
        <Button title="Return to payment" variant="soft" onPress={() => setPhase('paying')} style={{ marginTop: spacing.md, alignSelf: 'stretch' }} />
        <Button title="Leave for now" variant="ghost" onPress={leave} style={{ marginTop: spacing.sm, alignSelf: 'stretch' }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['bottom']}>
      <View style={{ flex: 1 }}>
        <WebView
          source={{ uri: url }}
          style={{ flex: 1 }}
          originWhitelist={['https://*']}
          onShouldStartLoadWithRequest={req => req.url.startsWith('https://') || req.url === 'about:blank'}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
        />
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : null}
      </View>
      <View style={styles.bar}>
        {amountLabel ? <Text style={[text.small, { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm }]}>{'Amount to pay ' + amountLabel}</Text> : null}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button title="Cancel" variant="soft" onPress={leave} style={{ flex: 1 }} />
          <Button title="I have paid" onPress={finish} style={{ flex: 1.4 }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  badge: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  title: { color: colors.text, textAlign: 'center', marginBottom: spacing.sm },
  muted: { color: colors.textMuted, textAlign: 'center' },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  bar: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
