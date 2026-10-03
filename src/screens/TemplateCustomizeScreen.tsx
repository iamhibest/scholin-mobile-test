import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Button, Card, ColorPicker, Notice, Screen, Skeleton, SwitchRow } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { useStaff } from '../lib/useStaff';
import { saveTemplate } from '../lib/admin';
import { getSampleData, templateHtml } from '../lib/templateSample';
import { REPORT_CARD_DEFAULTS, REPORT_CARD_PRESETS } from '../reportcard/themes';

type State = { primary_color: string; secondary_color: string; accent_color: string; background_color: string; black_and_white: boolean; theme_name: string | null };

const FIELDS: { key: keyof State; label: string }[] = [
  { key: 'primary_color', label: 'Primary' },
  { key: 'secondary_color', label: 'Secondary' },
  { key: 'accent_color', label: 'Accent' },
  { key: 'background_color', label: 'Background' },
];

const valid = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);

export default function TemplateCustomizeScreen({ navigation, route }: any) {
  const { templateKey, name } = route.params;
  const { ctx } = useStaff();
  const [state, setState] = useState<State | null>(null);
  const [sample, setSample] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState<keyof State | null>(null);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  useEffect(() => {
    navigation.setOptions({ title: 'Customise ' + name });
  }, [navigation, name]);

  useEffect(() => {
    if (!ctx) {
      return;
    }
    (async () => {
      const { data: row } = await supabase.rpc('get_report_card_template', { p_school_id: ctx.schoolId });
      const active = row && row.report_template === templateKey;
      setState(
        active
          ? {
              primary_color: row.primary_color,
              secondary_color: row.secondary_color,
              accent_color: row.accent_color,
              background_color: row.background_color,
              black_and_white: !!row.black_and_white,
              theme_name: row.theme_name || null,
            }
          : { ...((REPORT_CARD_DEFAULTS as any)[templateKey] || { primary_color: '#064C42', secondary_color: '#7a1f2b', accent_color: '#F7C95A', background_color: '#FFFFFF' }), black_and_white: false, theme_name: null },
      );
      setSample(await getSampleData(ctx.school));
    })();
  }, [ctx, templateKey]);

  if (!state || !sample) {
    return (
      <Screen>
        <Skeleton height={260} radius={24} />
      </Screen>
    );
  }

  const allValid = FIELDS.every(f => valid(String(state[f.key])));
  const html = templateHtml(templateKey, sample, allValid ? state : {});

  const preset = (key: string) => {
    const p: any = (REPORT_CARD_PRESETS as any)[key];
    setState({ primary_color: p.primary, secondary_color: p.secondary, accent_color: p.accent, background_color: p.background, black_and_white: !!p.blackAndWhite, theme_name: key });
  };

  const save = async () => {
    if (!ctx) {
      return;
    }
    if (!allValid) {
      setNotice({ message: 'Colours must look like #1A56DB (a # and six letters or numbers).', tone: 'error' });
      return;
    }
    setSaving(true);
    try {
      await saveTemplate(ctx.schoolId, ctx.userId, { report_template: templateKey, ...state });
      setNotice({ message: 'Template saved and activated. Every report card generated from now on will use this design.', tone: 'success' });
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setSaving(false);
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.preview}>
          <WebView originWhitelist={['*']} source={{ html }} style={{ flex: 1, backgroundColor: '#E5E7EB' }} scalesPageToFit bounces={false} nestedScrollEnabled />
        </View>
        <Notice message={notice.message} tone={notice.tone} />

        <Text style={[text.h3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.md }]}>Colour presets</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
          {Object.keys(REPORT_CARD_PRESETS).map(key => {
            const p: any = (REPORT_CARD_PRESETS as any)[key];
            return (
              <Pressable key={key} onPress={() => preset(key)} style={[styles.preset, state.theme_name === key && { borderColor: colors.primary }]}>
                <View style={styles.presetBars}>
                  <View style={{ flex: 1, backgroundColor: p.primary }} />
                  <View style={{ flex: 1, backgroundColor: p.accent }} />
                </View>
                <Text style={[text.caption, { color: colors.text, marginTop: 6, textAlign: 'center' }]} numberOfLines={1}>{p.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Card style={{ marginTop: spacing.lg }}>
          <SwitchRow label="Black and white" desc="Print friendly, no colour." value={state.black_and_white} onChange={v => setState({ ...state, black_and_white: v })} />
          <View style={{ opacity: state.black_and_white ? 0.4 : 1 }} pointerEvents={state.black_and_white ? 'none' : 'auto'}>
            {FIELDS.map(f => {
              const v = String(state[f.key]);
              return (
                <Pressable key={f.key} onPress={() => setPicking(f.key)} style={styles.colorRow}>
                  <View style={[styles.dot, { backgroundColor: valid(v) ? v : '#FFFFFF' }]} />
                  <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]}>{f.label}</Text>
                  <Text style={[text.small, { color: colors.textMuted, marginRight: 4 }]}>{v.toUpperCase()}</Text>
                  <Text style={[text.small, { color: colors.primary }]}>Change</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
        <ColorPicker
          visible={picking !== null}
          title={picking ? 'Pick ' + FIELDS.find(f => f.key === picking)!.label.toLowerCase() + ' colour' : ''}
          value={picking ? String(state[picking]) : '#000000'}
          onClose={() => setPicking(null)}
          onPick={hex => picking && setState({ ...state, [picking]: hex, theme_name: null } as State)}
        />
        <Button title="Save and activate" loading={saving} onPress={save} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  preview: { height: 380, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginBottom: spacing.lg },
  preset: { width: 92, padding: 6, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' },
  presetBars: { flexDirection: 'row', height: 44, borderRadius: 10, overflow: 'hidden' },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  dot: { width: 34, height: 34, borderRadius: 15, borderWidth: 1, borderColor: colors.border },
  hex: { width: 110, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 15, color: colors.text, paddingVertical: 0 },
});
