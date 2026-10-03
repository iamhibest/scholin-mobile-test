import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Notice } from '../components';
import { colors, spacing } from '../theme';
import { downloadPdf, makePdf, sharePdf } from '../lib/pdfDoc';

export default function ReceiptScreen({ route }: any) {
  const { html, fileName } = route.params as { html: string; fileName: string };
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  const run = async (mode: 'share' | 'save') => {
    setBusy(mode);
    setNotice({ message: '', tone: 'success' });
    try {
      const pdf = await makePdf(html, fileName, { width: 595, height: 842, padding: 0 });
      if (mode === 'share') {
        await sharePdf(pdf.path, fileName);
      } else {
        const where = await downloadPdf(pdf.path, pdf.fileName);
        setNotice({ message: 'Saved to ' + where, tone: 'success' });
      }
    } catch (e: any) {
      setNotice({ message: e.message || 'Could not create the PDF.', tone: 'error' });
    }
    setBusy('');
  };

  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <WebView originWhitelist={['*']} source={{ html }} style={styles.web} scalesPageToFit bounces={false} />
      <View style={styles.bar}>
        <Notice message={notice.message} tone={notice.tone} />
        <View style={styles.row}>
          <Button title="Save PDF" variant="soft" loading={busy === 'save'} onPress={() => run('save')} style={{ flex: 1 }} />
          <Button title="Share" loading={busy === 'share'} onPress={() => run('share')} style={{ flex: 1 }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E5E7EB' },
  web: { flex: 1, backgroundColor: '#E5E7EB' },
  bar: { padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  row: { flexDirection: 'row', gap: spacing.md },
});
