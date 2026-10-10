import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, BottomSheet, Button, Card, Checkbox, EmptyState, Icon, Notice, OptionField, Screen, Skeleton } from '../components';
import { colors, fonts, radius, shadow, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { showError } from '../lib/confirm';
import { fetchClassRoster } from '../lib/school';
import { Component, fetchClassSubjectList, fetchComponents, fetchSubjectResults, saveSubjectResults } from '../lib/portal';
import { ordinalRC } from '../reportcard/helpers';

export default function ClassResultsScreen({ navigation, route }: any) {
  const { classId, sessionId, termId, termName, className } = route.params;
  const { ctx } = useStaff();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState(false);
  const [components, setComponents] = useState<Component[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [roster, setRoster] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [scores, setScores] = useState<Record<string, Record<string, string>>>({});
  const [published, setPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const listRef = useRef<FlatList renderScrollComponent={(sp: any) => <ScrollView {...sp} />}<any>>(null);
  const [sortKey, setSortKey] = useState<'name' | 'total'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sheet, setSheet] = useState(false);
  const [publishNow, setPublishNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  useEffect(() => {
    navigation.setOptions({ title: 'Edit / Add Results' });
    Promise.all([fetchComponents(termId), fetchClassSubjectList(classId), fetchClassRoster(classId, sessionId)])
      .then(([c, s, r]) => {
        setComponents(c);
        setSubjects(s);
        setRoster(r);
        setReady(true);
      })
      .catch(e => {
        showError(e.message);
        setReady(true);
      });
  }, [classId, termId, sessionId, navigation]);

  const choose = async (id: string) => {
    setSubjectId(id);
    setNotice({ message: '', tone: 'success' });
    if (!id) {
      return;
    }
    setLoading(true);
    try {
      const { map, published: pub } = await fetchSubjectResults(classId, termId, id);
      const text: Record<string, Record<string, string>> = {};
      Object.keys(map).forEach(sid => {
        text[sid] = {};
        Object.keys(map[sid]).forEach(cid => {
          text[sid][cid] = String(map[sid][cid]);
        });
      });
      setScores(text);
      setPublished(pub);
    } catch (e: any) {
      showError(e.message);
    }
    setLoading(false);
  };

  const setScore = (studentId: string, comp: Component, raw: string) => {
    let value = raw.replace(/[^0-9.]/g, '');
    const firstDot = value.indexOf('.');
    if (firstDot !== -1) {
      value = value.slice(0, firstDot + 1) + value.slice(firstDot + 1).replace(/\./g, '');
    }
    setScores(s => ({ ...s, [studentId]: { ...(s[studentId] || {}), [comp.id]: value } }));
  };

  const isOver = (studentId: string, comp: Component) => {
    const v = parseFloat((scores[studentId] || {})[comp.id]);
    return !isNaN(v) && v > parseFloat(String(comp.max_score));
  };

  const totalOf = (studentId: string) => {
    const mine = scores[studentId] || {};
    return components.reduce((sum, c) => {
      const v = parseFloat(mine[c.id]);
      return sum + (isNaN(v) ? 0 : v);
    }, 0);
  };

  const ranks = useMemo(() => {
    const order = roster.map(s => ({ id: s.id, total: totalOf(s.id) })).sort((a, b) => b.total - a.total);
    const map: Record<string, number> = {};
    order.forEach((o, i) => {
      map[o.id] = i + 1;
    });
    return map;
  }, [roster, scores, components]);

  const sorted = useMemo(() => {
    const list = roster.map(s => ({ s, total: totalOf(s.id) }));
    list.sort((a, b) => {
      const cmp = sortKey === 'name' ? String(a.s.full_name).localeCompare(String(b.s.full_name)) : a.total - b.total;
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [roster, scores, components, sortKey, sortDir]);

  const overs = useMemo(() => {
    const list: { id: string; name: string; comp: string; value: string; max: string }[] = [];
    roster.forEach(st => {
      components.forEach(c => {
        const raw = (scores[st.id] || {})[c.id];
        const v = parseFloat(raw);
        if (!isNaN(v) && v > parseFloat(String(c.max_score))) {
          list.push({ id: st.id + ':' + c.id, name: st.full_name, comp: c.name, value: raw, max: String(c.max_score) });
        }
      });
    });
    return list;
  }, [roster, scores, components]);

  const orderKeys = useMemo(() => {
    const keys: string[] = [];
    sorted.forEach(({ s }) => components.forEach(c => keys.push(s.id + ':' + c.id)));
    return keys;
  }, [sorted, components]);

  const goNext = (key: string) => {
    const [sid, cid] = key.split(':');
    const comp = components.find(c => c.id === cid);
    if (comp && isOver(sid, comp)) {
      const st = roster.find(r => r.id === sid);
      Alert.alert('Score is more than the assigned score', (st ? st.full_name + ': ' : '') + comp.name + ' cannot be more than ' + comp.max_score + '. Please correct it.');
      return;
    }
    const at = orderKeys.indexOf(key);
    const nextKey = orderKeys[at + 1];
    if (!nextKey) {
      inputRefs.current[key]?.blur();
      return;
    }
    const nextStudent = nextKey.split(':')[0];
    if (nextStudent !== sid) {
      const row = sorted.findIndex(x => x.s.id === nextStudent);
      if (row >= 0 && listRef.current) {
        try {
          listRef.current.scrollToIndex({ index: row, animated: true, viewPosition: 0.2 });
        } catch {}
      }
    }
    setTimeout(() => inputRefs.current[nextKey]?.focus(), 60);
  };

  const toggleSort = (key: 'name' | 'total') => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const save = async () => {
    if (!ctx) {
      return;
    }
    setSaving(true);
    const numeric: Record<string, Record<string, number>> = {};
    Object.keys(scores).forEach(sid => {
      numeric[sid] = {};
      Object.keys(scores[sid]).forEach(cid => {
        const v = parseFloat(scores[sid][cid]);
        if (!isNaN(v)) {
          numeric[sid][cid] = v;
        }
      });
    });
    try {
      await saveSubjectResults({ classId, termId, subjectId, userId: ctx.userId, components, roster, scores: numeric, publish: publishNow });
      setPublished(publishNow);
      setSheet(false);
      setNotice({ message: 'Scores saved.', tone: 'success' });
    } catch (e: any) {
      setSheet(false);
      setNotice({ message: e.message, tone: 'error' });
    }
    setSaving(false);
  };

  if (!ready) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={60} radius={16} />
          <Skeleton height={140} radius={20} />
        </View>
      </Screen>
    );
  }

  const noComponents = components.length === 0;
  const maxTotal = components.reduce((sum, c) => sum + parseFloat(String(c.max_score)), 0);

  const header = (
    <View>
      <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>{className + '  |  ' + termName}</Text>
      {noComponents ? (
        <View style={styles.warn}>
          <Icon name="info" size={18} color={colors.accentDark} />
          <Text style={[text.small, { color: colors.accentDark, flex: 1 }]}>
            {ctx && ctx.isAdmin ? 'Define assessment components (for example 1st CA, 2nd CA, Exam) for this term in Sessions and Terms before scores can be entered.' : 'Your school admin needs to define assessment components for this term before scores can be entered.'}
          </Text>
        </View>
      ) : null}
      <OptionField
        label="Subject"
        value={subjectId}
        options={subjects.map(s => ({ value: s.id, label: s.name }))}
        placeholder={subjects.length ? 'Select a subject' : 'No subjects assigned to this class yet'}
        hint="Need to add a subject? Open Class Subjects in the class workspace."
        onChange={choose}
      />
      {subjectId && !loading && !noComponents ? (
        <View>
          <View style={[styles.badge, { backgroundColor: published ? colors.successSoft : colors.primarySoft }]}>
            <Icon name={published ? 'check' : 'clock'} size={16} color={published ? colors.success : colors.primary} />
            <Text style={[text.caption, { color: published ? colors.success : colors.primary }]}>{published ? 'Published to report card' : 'Draft, not yet published'}</Text>
          </View>
          <View style={styles.warn}>
            <Icon name="info" size={18} color={colors.accentDark} />
            <Text style={[text.small, { color: colors.accentDark, flex: 1 }]}>Do not add scores for students who do not offer this subject. Subjects left blank for a student are automatically excluded from their report card.</Text>
          </View>
          <Notice message={notice.message} tone={notice.tone} />
          <View style={styles.sortRow}>
            <Text style={[text.caption, { color: colors.textMuted }]}>SORT BY</Text>
            {(['name', 'total'] as const).map(k => (
              <Pressable key={k} onPress={() => toggleSort(k)} style={[styles.sortChip, sortKey === k && { backgroundColor: colors.primary }]}>
                <Text style={[text.caption, { color: sortKey === k ? '#FFFFFF' : colors.textMuted }]}>{(k === 'name' ? 'Name' : 'Total') + (sortKey === k ? (sortDir === 'asc' ? '  \u2191' : '  \u2193') : '')}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : null}
    </View>
  );

  const showList = !!subjectId && !loading && !noComponents;

  return (
    <Screen padded={false}>
      <FlatList renderScrollComponent={(sp: any) => <ScrollView {...sp} />}
        ref={listRef}
        data={showList ? sorted : []}
        initialNumToRender={Math.max(12, roster.length)}
        removeClippedSubviews={false}
        onScrollToIndexFailed={info => listRef.current && listRef.current.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true })}
        keyExtractor={i => i.s.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.list, { paddingBottom: 120 + insets.bottom }]}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !subjectId || loading || noComponents ? null : <EmptyState icon="users" title="No students in this class yet" message="Your school admin needs to assign students to this class first." />
        }
        renderItem={({ item }) => {
          const { s, total } = item;
          return (
            <Card style={{ padding: spacing.md }}>
              <View style={styles.top}>
                <Avatar name={s.full_name} uri={s.photo_url || undefined} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{s.full_name}</Text>
                  <Text style={[text.small, { color: colors.textMuted }]}>{s.admission_no || ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.total}>{total + ' / ' + maxTotal}</Text>
                  <Text style={[text.caption, { color: colors.primary }]}>{total > 0 ? ordinalRC(ranks[s.id]) : ''}</Text>
                </View>
              </View>
              <View style={styles.inputs}>
                {components.map(c => {
                  const key = s.id + ':' + c.id;
                  const over = isOver(s.id, c);
                  const last = orderKeys[orderKeys.length - 1] === key;
                  return (
                    <View key={c.id} style={styles.inputBox}>
                      <Text style={[text.caption, { color: over ? colors.danger : colors.textMuted }]} numberOfLines={1}>{c.name + ' /' + c.max_score}</Text>
                      <TextInput
                        ref={r => {
                          inputRefs.current[key] = r;
                        }}
                        value={(scores[s.id] || {})[c.id] ?? ''}
                        onChangeText={v => setScore(s.id, c, v)}
                        keyboardType="decimal-pad"
                        returnKeyType={last ? 'done' : 'next'}
                        blurOnSubmit={last}
                        onSubmitEditing={() => goNext(key)}
                        placeholder="-"
                        placeholderTextColor="#9CA3AF"
                        style={[styles.input, over && styles.inputOver]}
                        selectTextOnFocus
                      />
                      {over ? <Text style={[text.caption, { color: colors.danger, marginTop: 2 }]}>{'More than ' + c.max_score}</Text> : null}
                    </View>
                  );
                })}
              </View>
            </Card>
          );
        }}
      />

      {showList && overs.length > 0 ? (
        <View style={[styles.overBar, { bottom: 92 + insets.bottom }]}>
          <Icon name="info" size={18} color="#FFFFFF" />
          <Text style={[text.small, { color: '#FFFFFF', flex: 1 }]}>
            {overs[0].name + ': ' + overs[0].comp + ' is ' + overs[0].value + ', more than the assigned score of ' + overs[0].max + (overs.length > 1 ? '. ' + (overs.length - 1) + ' more to fix.' : '.')}
          </Text>
        </View>
      ) : null}

      {showList && roster.length > 0 ? (
        <View style={[styles.bar, shadow.raised, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
          <Button
            title="Save scores"
            icon="arrowRight"
            onPress={() => {
              if (overs.length > 0) {
                Alert.alert('Score is more than the assigned score', overs.length + (overs.length === 1 ? ' entry is' : ' entries are') + ' more than the maximum. Fix the highlighted scores before saving.');
                return;
              }
              setPublishNow(published);
              setSheet(true);
            }}
          />
        </View>
      ) : null}

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Save scores">
        <Text style={[text.body, { color: colors.textMuted, marginBottom: spacing.lg }]}>Saving replaces the scores for this subject with what you see on screen.</Text>
        <Checkbox checked={publishNow} onChange={setPublishNow}>
          <Text style={[text.bodyStrong, { color: colors.text }]}>Publish to report card</Text>
          <Text style={[text.small, { color: colors.textMuted }]}>Only published subjects appear on generated report cards.</Text>
        </Checkbox>
        <Button title="Save" loading={saving} onPress={save} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  warn: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, marginBottom: spacing.md },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  sortChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  total: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  inputs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  inputBox: { flexGrow: 1, flexBasis: '30%', minWidth: 88 },
  input: { marginTop: 4, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 16, color: colors.text, paddingVertical: 0 },
  inputOver: { borderColor: colors.danger, backgroundColor: colors.dangerSoft, color: colors.danger },
  overBar: { position: 'absolute', left: spacing.xl, right: spacing.xl, flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.danger, borderRadius: radius.md, padding: spacing.md },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, paddingHorizontal: spacing.xl, paddingTop: spacing.md, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
});
