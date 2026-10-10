import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Card, Screen, Skeleton } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';

type Tab = 'terms' | 'privacy' | 'contact' | 'about';

type Settings = {
  terms_and_conditions?: string;
  terms_updated_at?: string;
  privacy_policy?: string;
  privacy_updated_at?: string;
  contact_info?: string;
  contact_updated_at?: string;
  about_scholin?: string;
  about_updated_at?: string;
};

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'terms', label: 'Terms' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'contact', label: 'Contact' },
  { key: 'about', label: 'About' },
];

const EMPTY: Record<Tab, string> = {
  terms: 'Terms and Conditions have not been set up yet.',
  privacy: 'The Privacy Policy has not been set up yet.',
  contact: 'Contact information has not been set up yet.',
  about: 'About Scholin has not been set up yet.',
};

function formatDate(value?: string) {
  if (!value) {
    return '';
  }
  return 'Last updated ' + new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

const TOKEN = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]]|\+?\d[\d\s-]{7,}\d)/gi;

// Plain text where emails, web addresses and phone numbers can be tapped.
function RichText({ value }: { value: string }) {
  const parts = value.split(TOKEN);
  return (
    <Text selectable style={[text.body, { color: colors.text }]}>
      {parts.map((p, i) => {
        if (i % 2 === 0) {
          return p;
        }
        const isMail = p.indexOf('@') > 0;
        const isWeb = /^(https?:\/\/|www\.)/i.test(p);
        const target = isMail ? 'mailto:' + p : isWeb ? (/^https?:\/\//i.test(p) ? p : 'https://' + p) : 'tel:' + p.replace(/[\s-]/g, '');
        return (
          <Text key={i} style={{ color: colors.primary, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(target).catch(() => {})}>
            {p}
          </Text>
        );
      })}
    </Text>
  );
}

export default function TermsScreen({ route }: any) {
  const initial: Tab = route && route.params && route.params.tab ? route.params.tab : 'terms';
  const [tab, setTab] = useState<Tab>(initial);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('*')
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

  const bodyOf: Record<Tab, string | undefined> = {
    terms: settings?.terms_and_conditions,
    privacy: settings?.privacy_policy,
    contact: settings?.contact_info,
    about: settings?.about_scholin,
  };
  const metaOf: Record<Tab, string | undefined> = {
    terms: settings?.terms_updated_at,
    privacy: settings?.privacy_updated_at,
    contact: settings?.contact_updated_at,
    about: settings?.about_updated_at,
  };
  const body = bodyOf[tab] || EMPTY[tab];
  const meta = bodyOf[tab] ? formatDate(metaOf[tab]) : '';

  return (
    <Screen scroll>
      <View style={styles.tabs}>
        {TABS.map(t => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]}>
            <Text style={[text.bodyStrong, { color: tab === t.key ? colors.primary : colors.textMuted, fontSize: 13 }]} numberOfLines={1}>{t.label}</Text>
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
            <RichText value={body} />
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
