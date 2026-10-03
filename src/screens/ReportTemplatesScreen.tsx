import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Badge, Button, Card, EmptyState, Notice, Screen, Skeleton } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { useStaff } from '../lib/useStaff';
import { saveTemplate } from '../lib/admin';
import { REPORT_CARD_DEFAULTS, REPORT_CARD_TEMPLATES, resolveTheme } from '../reportcard/themes';

export default function ReportTemplatesScreen({ navigation }: any) {
  const { ctx, loading: ctxLoading } = useStaff();
  const [row, setRow] = useState<any>(null);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    const { data } = await supabase.rpc('get_report_card_template', { p_school_id: ctx.schoolId });
    setRow(data || {});
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const activate = async (key: string) => {
    if (!ctx || !row) {
      return;
    }
    setBusy(key);
    try {
      const own: any = (REPORT_CARD_DEFAULTS as any)[key];
      await saveTemplate(ctx.schoolId, ctx.userId, {
        report_template: key,
        primary_color: own ? own.primary_color : row.primary_color || '#064C42',
        secondary_color: own ? own.secondary_color : row.secondary_color || '#7a1f2b',
        accent_color: own ? own.accent_color : row.accent_color || '#F7C95A',
        background_color: own ? own.background_color : row.background_color || '#FFFFFF',
        black_and_white: row.black_and_white || false,
        theme_name: own ? null : row.theme_name || null,
      });
      setNotice({ message: 'Template activated. Every report card generated from now on will use this design.', tone: 'success' });
      await load();
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy('');
  };

  if (ctxLoading || !row) {
    return (
      <Screen>
        <Skeleton height={200} radius={24} />
      </Screen>
    );
  }

  if (ctx && !ctx.isAdmin) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Admins only" message="Only the school owner and teacher admins can change the report card design." />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>Pick the design every report card uses, and customise its colours.</Text>
        <Notice message={notice.message} tone={notice.tone} />
        {REPORT_CARD_TEMPLATES.map((t: any) => {
          const active = row.report_template === t.key;
          const theme = resolveTheme(active ? row : {}, t.key);
          return (
            <Card key={t.key} style={[styles.card, active && { borderColor: colors.primary, borderWidth: 2 }]}>
              <View style={styles.swatchRow}>
                <View style={[styles.swatch, { backgroundColor: theme.primary }]} />
                <View style={[styles.swatch, { backgroundColor: theme.secondary }]} />
                <View style={[styles.swatch, { backgroundColor: theme.accent }]} />
                <View style={{ flex: 1 }} />
                {active ? <Badge label="Active" tone="green" /> : null}
              </View>
              <Text style={[text.h3, { color: colors.text, marginTop: spacing.md }]}>{t.name}</Text>
              <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>{t.description}</Text>
              <View style={styles.actions}>
                <Button title="Preview" variant="soft" style={styles.action} onPress={() => navigation.navigate('TemplatePreview', { templateKey: t.key, name: t.name })} />
                <Button title="Customise" variant="outline" style={styles.action} onPress={() => navigation.navigate('TemplateCustomize', { templateKey: t.key, name: t.name })} />
                {active ? (
                  <Button title="Active" icon="check" variant="soft" disabled style={styles.action} onPress={() => {}} />
                ) : (
                  <Button title="Activate" loading={busy === t.key} style={styles.action} onPress={() => activate(t.key)} />
                )}
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  card: { marginBottom: spacing.lg },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  action: { flex: 1, height: 44, paddingHorizontal: 8 },
});
