import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Screen, Skeleton } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';

type Settings = {
  terms_and_conditions?: string;
  terms_updated_at?: string;
  about_scholin?: string;
  about_updated_at?: string;
};

function formatDate(value?: string) {
  if (!value) {
    return '';
  }
  return 'Last updated ' + new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function TermsScreen() {
  const [tab, setTab] = useState<'terms' | 'about'>('terms');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('terms_and_conditions, terms_updated_at, about_scholin, about_updated_at')
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setFailed(true);
        } else {
          setSettings(data);
        }
        setLoading(false);
      });
  }, []);

  const isTerms = tab === 'terms';
  const body = isTerms ? settings?.terms_and_conditions || 'Terms and Conditions have not been set up yet.' : settings?.about_scholin || 'About Scholin has not been set up yet.';
  const meta = formatDate(isTerms ? settings?.terms_updated_at : settings?.about_updated_at);

  return (
    <Screen scroll>
      <View style={styles.tabs}>
        {(['terms', 'about'] as const).map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[text.bodyStrong, { color: tab === t ? colors.primary : colors.textMuted }]}>{t === 'terms' ? 'Terms and Conditions' : 'About Scholin'}</Text>
          </Pressable>
        ))}
      </View>
      <Card>
        {loading ? (
          <View style={{ gap: 10 }}>
            <Skeleton height={14} />
            <Skeleton height={14} width="92%" />
            <Skeleton height={14} width="80%" />
          </View>
        ) : failed ? (
          <Text style={[text.body, { color: colors.textMuted }]}>Could not load this right now. Please try again later.</Text>
        ) : (
          <>
            {meta ? <Text style={[text.caption, { color: colors.textMuted, marginBottom: spacing.md }]}>{meta}</Text> : null}
            <Text style={[text.body, { color: colors.text }]}>{body}</Text>
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: 4, marginBottom: spacing.lg },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md },
  tabActive: { backgroundColor: colors.surface },
});
