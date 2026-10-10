import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useFocusEffect } from '@react-navigation/native';
import { Button, EmptyState, Notice, PressableScale, SchoolMark, Screen, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { supabase } from '../lib/supabase';
import { chooseSchool, fetchMySchools, ROLE_LABEL } from '../lib/account';

function Row({ m, index, active, busy, onPress }: any) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 380, delay: Math.min(index, 6) * 60, useNativeDriver: true }).start();
  }, [enter, index]);
  const s = m.schools || {};
  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>
      <PressableScale onPress={active ? undefined : onPress} style={[styles.row, active && styles.rowOn]}>
        <SchoolMark name={s.name || 'School'} uri={s.logo_url} size={50} />
        <View style={{ flex: 1 }}>
          <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={2}>{s.name || 'School'}</Text>
          <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>{ROLE_LABEL[m.role] || m.role}</Text>
        </View>
        {active ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Current</Text>
          </View>
        ) : busy ? (
          <Text style={[text.small, { color: colors.primary }]}>Switching</Text>
        ) : (
          <Text style={[text.small, { color: colors.primary, fontFamily: fonts.semibold }]}>Switch</Text>
        )}
      </PressableScale>
    </Animated.View>
  );
}

export default function MySchoolsScreen({ navigation }: any) {
  const [uid, setUid] = useState('');
  const [state, setState] = useState<{ activeId: string; list: any[] } | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const id = data.session?.user?.id;
      if (!id) {
        return;
      }
      setUid(id);
      setState(await fetchMySchools(id));
    } catch (e: any) {
      setState({ activeId: '', list: [] });
      setError(e.message || 'Could not load your schools.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pick = async (schoolId: string) => {
    setBusy(schoolId);
    setError('');
    try {
      await chooseSchool(uid, schoolId);
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e: any) {
      setError(e.message || 'Could not switch school.');
      setBusy('');
    }
  };

  if (!state) {
    return (
      <Screen>
        <Skeleton height={86} radius={20} />
        <Skeleton height={86} radius={20} style={{ marginTop: spacing.md }} />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Notice message={error} tone="error" />
        {state.list.length === 0 ? <EmptyState icon="school" title="No schools yet" message="You are not a member of any school yet." /> : null}
        {state.list.map((m, i) => (
          <Row key={m.school_id} m={m} index={i} active={m.school_id === state.activeId} busy={busy === m.school_id} onPress={() => pick(m.school_id)} />
        ))}
        <Button title="Join another school" variant="soft" onPress={() => navigation.navigate('JoinAnotherSchool')} style={{ marginTop: spacing.lg }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1.5, borderColor: '#EEF1F6' },
  rowOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.primary },
  badgeText: { color: '#FFFFFF', fontSize: 11.5, fontFamily: fonts.semibold },
});
