import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import Svg, { Circle, Line } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { AdSlot, BottomSheet, EmptyState, Icon, JobCard, JobSkeleton, Notice, PressableScale, Screen } from '../components';
import { VGREEN } from '../components/JobCard';
import { colors, fonts, radius, spacing, text } from '../theme';
import { loadAdConfig } from '../lib/ads';
import { AdsModule } from '../lib/adsNative';
import { CATEGORIES, daysLeft, fetchOpenVacancies, fetchVacancyFlags, isNew, loadSaved, toggleSaved, Vacancy } from '../lib/vacancies';

type Row = { kind: 'job'; vacancy: Vacancy; index: number } | { kind: 'ad'; key: string };
type Sort = 'newest' | 'closing';

function Lens() {
  return (
    <Svg width={150} height={130} viewBox="0 0 150 130">
      <Circle cx="95" cy="62" r="50" fill="#CFE6D8" opacity="0.7" />
      <Circle cx="62" cy="54" r="30" fill="none" stroke={VGREEN.dark} strokeWidth="9" />
      <Circle cx="62" cy="54" r="22" fill="#FFFFFF" opacity="0.65" />
      <Line x1="84" y1="76" x2="116" y2="108" stroke={VGREEN.dark} strokeWidth="13" strokeLinecap="round" />
      <Circle cx="50" cy="42" r="5" fill="#FFFFFF" opacity="0.9" />
    </Svg>
  );
}

export default function VacanciesScreen({ navigation }: any) {
  const [items, setItems] = useState<Vacancy[] | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('all');
  const [place, setPlace] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [onlyNew, setOnlyNew] = useState(false);
  const [onlyClosing, setOnlyClosing] = useState(false);
  const [onlySaved, setOnlySaved] = useState(false);
  const [sheet, setSheet] = useState<'none' | 'filter' | 'place' | 'sort'>('none');
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

  const places = useMemo(() => {
    const set = new Set<string>();
    (items || []).forEach(v => {
      if (v.location) {
        set.add(v.location.trim());
      }
    });
    return Array.from(set).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (items || []).filter(v => {
      if (cat !== 'all' && (v.category || 'teaching') !== cat) {
        return false;
      }
      if (place && String(v.location || '').trim() !== place) {
        return false;
      }
      if (onlyNew && !isNew(v)) {
        return false;
      }
      if (onlyClosing && daysLeft(v) > 3) {
        return false;
      }
      if (onlySaved && !saved.includes(v.id)) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        String((v.schools && v.schools.name) || '').toLowerCase().includes(q) ||
        String(v.location || '').toLowerCase().includes(q)
      );
    });
    if (sort === 'closing') {
      return list.slice().sort((a, b) => new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime());
    }
    return list;
  }, [items, query, cat, place, onlyNew, onlyClosing, onlySaved, saved, sort]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    filtered.forEach((v, i) => {
      out.push({ kind: 'job', vacancy: v, index: i });
      // A sponsored slot after every few listings, never at the top, and never back to back.
      if ((i + 1) % every === 0 && i + 1 < filtered.length && !onlySaved) {
        out.push({ kind: 'ad', key: 'ad' + i });
      }
    });
    return out;
  }, [filtered, every, onlySaved]);

  const onSave = async (id: string) => setSaved(await toggleSaved(id));

  if (!flags.pageEnabled) {
    return (
      <Screen>
        <EmptyState icon="briefcase" title="Job Vacancies unavailable" message="The vacancy board is switched off for now. Please check back later." />
      </Screen>
    );
  }

  const activeFilters = (onlyNew ? 1 : 0) + (onlyClosing ? 1 : 0) + (onlySaved ? 1 : 0);

  const header = (
    <View>
      <View style={styles.hero}>
        <View style={styles.orbA} />
        <View style={styles.orbB} />
        <View style={styles.heroLens}>
          <Lens />
        </View>
        <Text style={styles.heroKicker}>SCHOLIN</Text>
        <Text style={styles.heroTitle}>Vacancies</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Icon name="search" size={20} color={colors.textMuted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search job title, school or location" placeholderTextColor="#9CA3AF" style={styles.searchInput} numberOfLines={1} returnKeyType="search" />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10}>
              <Icon name="close" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={() => setSheet('filter')} style={styles.filterBtn}>
          <Icon name="settings" size={22} color={VGREEN.dark} />
          {activeFilters > 0 ? (
            <View style={styles.filterDot}>
              <Text style={styles.filterDotText}>{activeFilters}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.chips}>
        {[{ value: 'all', label: 'All Jobs' }, ...CATEGORIES].map(c => {
          const on = cat === c.value;
          return (
            <Pressable key={c.value} onPress={() => setCat(c.value)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && { color: '#FFFFFF' }]} numberOfLines={1}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.dropRow}>
        <Pressable onPress={() => setSheet('place')} style={[styles.drop, { flex: 1 }]}>
          <Icon name="pin" size={16} color={VGREEN.dark} />
          <Text style={styles.dropText} numberOfLines={1}>{place || 'All Locations'}</Text>
          <Icon name="chevronDown" size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable onPress={() => setSheet('sort')} style={[styles.drop, { flex: 1 }]}>
          <Text style={[styles.dropText, { color: colors.textMuted, flex: 0 }]}>Sort by</Text>
          <Text style={styles.dropText} numberOfLines={1}>{sort === 'newest' ? 'Newest' : 'Closing soon'}</Text>
          <Icon name="chevronDown" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.quick}>
        <PressableScale onPress={() => navigation.navigate('MyVacancies')} style={styles.quickBtn}>
          <Text style={styles.quickText} numberOfLines={1}>My postings</Text>
        </PressableScale>
        {flags.postingEnabled ? (
          <PressableScale onPress={() => navigation.navigate('PostVacancy', {})} style={[styles.quickBtn, { backgroundColor: VGREEN.dark }]}>
            <Text style={[styles.quickText, { color: '#FFFFFF' }]} numberOfLines={1}>Post a vacancy</Text>
          </PressableScale>
        ) : null}
      </View>

      <Notice message={error} tone="error" />
      {items ? <Text style={styles.found}>{filtered.length + (filtered.length === 1 ? ' vacancy found' : ' vacancies found')}</Text> : null}
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
      <FlatList renderScrollComponent={(sp: any) => <ScrollView {...sp} />}
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
            title={onlySaved ? 'No saved jobs' : 'No matching vacancies'}
            message={onlySaved ? 'Tap the bookmark on a job to keep it here.' : 'Try a different search or filter, or check back soon.'}
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
      <BottomSheet visible={sheet === 'filter'} onClose={() => setSheet('none')} title="Filters">
        {[
          { label: 'New this week', on: onlyNew, set: setOnlyNew },
          { label: 'Closing soon (3 days or less)', on: onlyClosing, set: setOnlyClosing },
          { label: 'Saved jobs only' + (saved.length ? ' (' + saved.length + ')' : ''), on: onlySaved, set: setOnlySaved },
        ].map(f => (
          <Pressable key={f.label} onPress={() => f.set(!f.on)} style={styles.opt}>
            <Text style={[styles.optText, f.on && { color: VGREEN.dark }]}>{f.label}</Text>
            <View style={[styles.box, f.on && { backgroundColor: VGREEN.dark, borderColor: VGREEN.dark }]}>{f.on ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}</View>
          </Pressable>
        ))}
        <Pressable
          onPress={() => {
            setOnlyNew(false);
            setOnlyClosing(false);
            setOnlySaved(false);
          }}
          style={{ paddingVertical: spacing.md }}>
          <Text style={[styles.optText, { color: VGREEN.mid, textAlign: 'center' }]}>Clear filters</Text>
        </Pressable>
      </BottomSheet>

      <BottomSheet visible={sheet === 'place'} onClose={() => setSheet('none')} title="Location">
        {['', ...places].map(p => (
          <Pressable
            key={p || 'all'}
            onPress={() => {
              setPlace(p);
              setSheet('none');
            }}
            style={styles.opt}>
            <Text style={[styles.optText, place === p && { color: VGREEN.dark }]}>{p || 'All Locations'}</Text>
            {place === p ? <Icon name="check" size={18} color={VGREEN.dark} /> : null}
          </Pressable>
        ))}
      </BottomSheet>

      <BottomSheet visible={sheet === 'sort'} onClose={() => setSheet('none')} title="Sort by">
        {([['newest', 'Newest'], ['closing', 'Closing soon']] as const).map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => {
              setSort(k);
              setSheet('none');
            }}
            style={styles.opt}>
            <Text style={[styles.optText, sort === k && { color: VGREEN.dark }]}>{label}</Text>
            {sort === k ? <Icon name="check" size={18} color={VGREEN.dark} /> : null}
          </Pressable>
        ))}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  hero: { backgroundColor: '#EAF3EC', borderRadius: radius.xl, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, overflow: 'hidden', minHeight: 132, justifyContent: 'center', borderWidth: 1, borderColor: '#DCEBE1' },
  orbA: { position: 'absolute', right: -50, top: -60, width: 190, height: 190, borderRadius: 95, backgroundColor: '#D5E8DB' },
  orbB: { position: 'absolute', right: 60, bottom: -90, width: 150, height: 150, borderRadius: 75, backgroundColor: '#E1EFE5' },
  heroLens: { position: 'absolute', right: 6, bottom: 0 },
  heroKicker: { color: VGREEN.dark, fontSize: 13, letterSpacing: 4, fontFamily: fonts.bold },
  heroTitle: { color: VGREEN.ink, fontSize: 34, lineHeight: 42, marginTop: 2, fontFamily: fonts.headingBold },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#E3E8E5', paddingHorizontal: 16 },
  searchInput: { flex: 1, fontSize: 14.5, fontFamily: fonts.body, color: colors.text, paddingVertical: 0 },
  filterBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#E3E8E5', alignItems: 'center', justifyContent: 'center' },
  filterDot: { position: 'absolute', right: 2, top: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: VGREEN.dark, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterDotText: { color: '#FFFFFF', fontSize: 11, fontFamily: fonts.bold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.lg },
  chip: { paddingHorizontal: 16, height: 40, borderRadius: radius.pill, backgroundColor: '#EEF1EF', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: VGREEN.dark },
  chipText: { fontSize: 13.5, color: '#4B5563', fontFamily: fonts.semibold },
  dropRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  drop: { height: 46, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: '#E3E8E5', paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropText: { flex: 1, fontSize: 13.5, color: colors.text, fontFamily: fonts.semibold },
  quick: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  quickBtn: { flex: 1, height: 46, borderRadius: radius.pill, backgroundColor: VGREEN.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  quickText: { fontSize: 14, color: VGREEN.dark, fontFamily: fonts.semibold },
  found: { color: colors.textMuted, fontSize: 13.5, marginTop: spacing.lg, marginBottom: spacing.md, fontFamily: fonts.medium },
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  optText: { flex: 1, fontSize: 15.5, color: colors.text, fontFamily: fonts.medium },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: '#C9CDD4', alignItems: 'center', justifyContent: 'center' },
});
