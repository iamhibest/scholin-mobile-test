import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, EmptyState, Screen } from '../components';
import { colors, fonts, shadow, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { showError } from '../lib/confirm';
import { buildReportCardHtml, createReportCardPdf } from '../lib/reportCardDoc';
import { downloadPdf, sharePdf } from '../lib/pdfDoc';

export default function ReportCardViewScreen({ navigation, route }: any) {
  const { studentId, studentName, classId, termId, sessionId, sessionName, termName } = route.params;
  const { ctx } = useStaff();
  const insets = useSafeAreaInsets();
  const webRef = useRef<any>(null);
  const [html, setHtml] = useState('');
  const [printHtml, setPrintHtml] = useState('');
  const [pageCount, setPageCount] = useState(1);
  const [page, setPage] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    navigation.setOptions({ title: studentName });
  }, [navigation, studentName]);

  useEffect(() => {
    if (!ctx) {
      return;
    }
    buildReportCardHtml({ studentId, classId, termId, sessionId, sessionName, termName, school: ctx.school })
      .then(r => {
        if (r.error === 'no_published_subjects') {
          setState('empty');
        } else {
          setHtml(r.html || '');
          setPrintHtml(r.printHtml || '');
          setState('ready');
        }
      })
      .catch(e => {
        setMessage(e.message || 'Could not generate this report card.');
        setState('error');
      });
  }, [ctx, studentId, classId, termId, sessionId, sessionName, termName]);

  const pdfRef = useRef<{ path: string; fileName: string } | null>(null);

  const ensurePdf = async () => {
    if (!pdfRef.current) {
      pdfRef.current = await createReportCardPdf(printHtml, studentName);
    }
    return pdfRef.current;
  };

  const doShare = async () => {
    setBusy('share');
    try {
      const pdf = await ensurePdf();
      await sharePdf(pdf.path, studentName + ' Report Card');
    } catch (e: any) {
      showError('Could not share the PDF: ' + (e.message || 'Unknown error'));
    }
    setBusy('');
  };

  const doDownload = async () => {
    setBusy('download');
    try {
      const pdf = await ensurePdf();
      const where = await downloadPdf(pdf.path, pdf.fileName);
      Alert.alert('Saved', 'The report card was saved to ' + where + ' as ' + pdf.fileName);
    } catch (e: any) {
      showError('Could not save the PDF: ' + (e.message || 'Unknown error'));
    }
    setBusy('');
  };

  const onMessage = (e: any) => {
    try {
      const m = JSON.parse(e.nativeEvent.data);
      if (m.type === 'pages') {
        setPageCount(m.count);
      } else if (m.type === 'page') {
        setPage(m.index);
      }
    } catch {}
  };

  const goTo = (i: number) => {
    setPage(i);
    webRef.current?.injectJavaScript('window.showPage(' + i + ');true;');
  };

  if (state === 'loading') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[text.body, { color: colors.textMuted, marginTop: spacing.lg }]}>Generating report card</Text>
        </View>
      </Screen>
    );
  }

  if (state === 'empty') {
    return (
      <Screen>
        <EmptyState icon="file" title="No published subjects yet" message='Scores must be marked "published" in Edit / Add Results before they appear on the report card.' />
      </Screen>
    );
  }

  if (state === 'error') {
    return (
      <Screen>
        <EmptyState icon="info" title="Could not generate this report card" message={message} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} background="#E5E7EB">
      <WebView ref={webRef} originWhitelist={['*']} source={{ html }} style={{ flex: 1, backgroundColor: '#E5E7EB' }} onMessage={onMessage} scalesPageToFit startInLoadingState bounces={false} />
      <View style={[styles.bar, shadow.raised, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
        {pageCount > 1 ? (
          <View style={styles.pager}>
            {Array.from({ length: pageCount }).map((_, i) => (
              <Pressable key={i} onPress={() => goTo(i)} style={[styles.pill, page === i && styles.pillOn]}>
                <Text style={[text.body, styles.pillText, page === i && styles.pillTextOn]}>{'Page ' + (i + 1)}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.actions}>
          <Button title="Share" icon="send" variant="outline" loading={busy === 'share'} disabled={busy !== '' && busy !== 'share'} onPress={doShare} style={{ flex: 1 }} />
          <Button title="Download" icon="down" loading={busy === 'download'} disabled={busy !== '' && busy !== 'download'} onPress={doDownload} style={{ flex: 1 }} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.md },
  pager: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.md },
  pill: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 20, backgroundColor: '#EEF1F6' },
  pillOn: { backgroundColor: colors.primary },
  pillText: { fontFamily: fonts.semibold, color: colors.textMuted },
  pillTextOn: { color: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bar: { backgroundColor: colors.surface, paddingHorizontal: spacing.xl, paddingTop: spacing.md, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
});
