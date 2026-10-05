import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Notice } from '../components';
import { colors, spacing, text } from '../theme';
import { downloadPdf, makePdf, sharePdf } from '../lib/pdfDoc';

export default function QrPosterScreen({ navigation, route }: any) {
  const { html, name } = route.params as { html: string; name: string };
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });
  const [pdf, setPdf] = useState<{ path: string; fileName: string } | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: 'Attendance poster' });
  }, [navigation]);

  const ensure = async () => {
    if (pdf) {
      return pdf;
    }
    const made = await makePdf(html, 'Scholin Attendance ' + name, { width: 595, height: 842, padding: 0 });
    setPdf(made);
    return made;
  };

  const run = async (mode: 'share' | 'download' | 'print') => {
    setBusy(mode);
    setNotice({ message: '', tone: 'success' });
    try {
      {
        const file = await ensure();
        if (mode === 'share') {
          await sharePdf(file.path, name + ' attendance poster');
        } else if (mode === 'print') {
          // The phone's own share sheet has a Print option, so no extra print library is needed.
          await sharePdf(file.path, 'Print ' + name + ' attendance poster');
        } else {
          const where = await downloadPdf(file.path, file.fileName);
          Alert.alert('Saved', 'The poster was saved to ' + where + ' as ' + file.fileName);
        }
      }
    } catch (e: any) {
      setNotice({ message: e.message || 'Could not create the poster.', tone: 'error' });
    }
    setBusy('');
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <WebView originWhitelist={['*']} source={{ html }} style={styles.web} scalesPageToFit bounces={false} startInLoadingState renderLoading={() => <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.primary} />} />
      <View style={styles.bar}>
        <Notice message={notice.message} tone={notice.tone} />
        <View style={styles.row}>
          <Button title="Share" icon="send" variant="outline" loading={busy === 'share'} onPress={() => run('share')} style={{ flex: 1 }} />
          <Button title="Download" icon="down" variant="outline" loading={busy === 'download'} onPress={() => run('download')} style={{ flex: 1 }} />
        </View>
        <Button title="Print" loading={busy === 'print'} onPress={() => run('print')} style={{ marginTop: spacing.md }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E5E7EB' },
  web: { flex: 1, backgroundColor: '#E5E7EB' },
  bar: { padding: spacing.lg, backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  row: { flexDirection: 'row', gap: spacing.md },
});
