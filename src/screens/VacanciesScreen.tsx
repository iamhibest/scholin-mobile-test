import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AdSlot, EmptyState, Fab, JobCard, JobSkeleton, Notice, PressableScale, Screen, SearchBar } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { loadAdConfig } from '../lib/ads';
import { AdsModule } from '../lib/adsNative';
import { daysLeft, fetchOpenVacancies, fetchVacancyFlags, isNew, loadSaved, toggleSaved, Vacancy } from '../lib/vacancies';

type Chip = 'all' | 'new' | 'closing' | 'saved';
type Row = { kind: 'job'; vacancy: Vacancy; index: number } | { kind: 'ad'; key: string };

const CHIPS: { value: Chip; label: string }[] = [
  { value: 'all', label: 'All jobs' },
  { value: 'new', label: 'New' },
  { value: 'closing', label: 'Closing soon' },
  { value: 'saved', label: 'Saved' },
];

function CountUp({ value }: { value: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration: 900, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value, anim]);
  return <Text style={styles.heroNumber}>{shown}</Text>;
}

export default function VacanciesScreen({ navigation }: any) {
  const [items, setItems] = useState<Vacancy[] | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<Chip>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [flags, setFlags] = useState({ pageEnabled: true, postingEnabled: true });
  const [every, setEvery] = useState(6);
  const seed = useRef(Math.random());

  const load = useCallback(async () => {
    try {
      setError('');
      const [list, f] = await Promise.all([fetchOpenVacancies(), fetchVacancyFlags()]);
      setFlags(f);
      // A stable shuffle for this visit so no posting is always stuck at the back.
      const keyed = list.map(v => ({ v, k: Math.abs(Math.sin(seed.current * 9301 + parseInt(v.id.replace(/[^0-9]/g, '').slice(0, 6) || '1', 10))) }));
      keyed.sort((a, b) => b.k - a.k);
      setItems(keyed.map(x => x.v));
    } catch (e: any) {
      setItems([]);
      setError(e.message || 'Could not load vacancies.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      loadSaved().then(setSaved);
    }, [load]),
  );

  useEffect(() => {
    if (AdsModule) {
      loadAdConfig().then(c => setEvery(c.feedEvery));
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items || []).filter(v => {
      if (chip === 'new' && !isNew(v)) {
        return false;
      }
      if (chip === 'closing' && daysLeft(v) > 3) {
        return false;
      }
      if (chip === 'saved' && !saved.includes(v.id)) {
        return false;
      }
      if (!q) {
        return true;
      }
      return v.title.toLowerCase().includes(q) || v.description.toLowerCase().includes(q) || String((v.schools && v.schools.name) || '').toLowerCase().includes(q);
    });
  }, [items, query, chip, saved]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    filtered.forEach((v, i) => {
      out.push({ kind: 'job', vacancy: v, index: i });
      // A sponsored slot after every few listings, never at the top, and never back to back.
      if ((i + 1) % every === 0 && i + 1 < filtered.length && chip !== 'saved') {
        out.push({ kind: 'ad', key: 'ad' + i });
      }
    });
    return out;
  }, [filtered, every, chip]);

  const onSave = async (id: string) => setSaved(await toggleSaved(id));

  if (!flags.pageEnabled) {
    return (
      <Screen>
        <EmptyState icon="briefcase" title="Job Vacancies unavailable" message="The vacancy board is switched off for now. Please check back later." />
      </Screen>
    );
  }

  const header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.orbA} />
        <View style={styles.orbB} />
        <Text style={styles.heroKicker}>Scholin Careers</Text>
        <View style={styles.heroRow}>
          <CountUp value={(items || []).length} />
          <Text style={styles.heroLabel}>{(items || []).length === 1 ? 'open position' : 'open positions'}</Text>
        </View>
        <Text style={styles.heroSub}>Teaching and school jobs from across Scholin</Text>
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <SearchBar value={query} onChange={setQuery} placeholder="Search job title, school or keyword" />
      </View>

      <View style={styles.chips}>
        {CHIPS.map(c => {
          const on = chip === c.value;
          return (
            <Pressable key={c.value} onPress={() => setChip(c.value)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && { color: '#FFFFFF' }]}>{c.label + (c.value === 'saved' && saved.length > 0 ? ' ' + saved.length : '')}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.quick}>
        <PressableScale onPress={() => navigation.navigate('MyVacancies')} style={styles.quickBtn}>
          <Text style={styles.quickText}>My postings</Text>
        </PressableScale>
        {flags.postingEnabled ? (
          <PressableScale onPress={() => navigation.navigate('PostVacancy', {})} style={[styles.quickBtn, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.quickText, { color: colors.primary }]}>Post a vacancy</Text>
          </PressableScale>
        ) : null}
      </View>

      <Notice message={error} tone="error" />
      {items && filtered.length > 0 ? <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>{filtered.length + (filtered.length === 1 ? ' job' : ' jobs')}</Text> : null}
    </View>
  );

  if (items === null) {
    return (
      <Screen padded={false}>
        <View style={styles.list}>
          {header}
          <JobSkeleton />
          <JobSkeleton />
          <JobSkeleton />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={rows}
        keyExtractor={r => (r.kind === 'job' ? r.vacancy.id : r.key)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={
          <EmptyState
            icon="briefcase"
            title={chip === 'saved' ? 'No saved jobs' : 'No matching vacancies'}
            message={chip === 'saved' ? 'Tap the bookmark on a job to keep it here.' : 'Try a different search, or check back soon.'}
          />
        }
        renderItem={({ item }) =>
          item.kind === 'job' ? (
            <JobCard
              vacancy={item.vacancy}
              index={item.index}
              saved={saved.includes(item.vacancy.id)}
              onPress={() => navigation.navigate('VacancyDetail', { id: item.vacancy.id })}
              onToggleSave={() => onSave(item.vacancy.id)}
            />
          ) : (
            <AdSlot />
          )
        }
        initialNumToRender={6}
        windowSize={9}
      />
      {flags.postingEnabled ? <Fab label="Post a vacancy" icon="plus" onPress={() => navigation.navigate('PostVacancy', {})} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: 120 },
  hero: { backgroundColor: colors.primary, borderRadius: radius.xl, padding: spacing.xl, overflow: 'hidden' },
  orbA: { position: 'absolute', right: -40, top: -50, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.10)' },
  orbB: { position: 'absolute', right: 40, bottom: -70, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,255,255,0.07)' },
  heroKicker: { color: 'rgba(255,255,255,0.8)', fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase', fontFamily: fonts.semibold },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 6 },
  heroNumber: { color: '#FFFFFF', fontSize: 44, lineHeight: 50, fontFamily: fonts.headingBold },
  heroLabel: { color: '#FFFFFF', fontSize: 16, marginBottom: 8, fontFamily: fonts.semibold },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4, fontFamily: fonts.body },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: '#EEF1F6' },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textMuted, fontFamily: fonts.semibold },
  quick: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.lg },
  quickBtn: { flex: 1, height: 44, borderRadius: radius.lg, backgroundColor: '#EEF1F6', alignItems: 'center', justifyContent: 'center' },
  quickText: { fontSize: 14, color: colors.text, fontFamily: fonts.semibold },
});
