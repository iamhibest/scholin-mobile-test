import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BottomSheet, Button, Card, EmptyState, Icon, Screen, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { showError } from '../lib/confirm';
import { fetchClassRoster } from '../lib/school';
import { fetchClassCounts, fetchCurrentSession, moveStudent } from '../lib/admin';

type Step = 'classes' | 'students' | 'destination' | 'done';

const label = (c: { name: string; arm?: string }) => c.name + (c.arm ? ' ' + c.arm : '');

export default function MigrationScreen({ navigation }: any) {
  const { ctx, loading: ctxLoading } = useStaff();
  const [session, setSession] = useState<any>(undefined);
  const [classes, setClasses] = useState<any[]>([]);
  const [step, setStep] = useState<Step>('classes');
  const [source, setSource] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [single, setSingle] = useState<any>(null);
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [busy, setBusy] = useState(false);
  const [doneMessage, setDoneMessage] = useState('');

  const loadClasses = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      const s = await fetchCurrentSession(ctx.schoolId);
      setSession(s || null);
      if (s) {
        setClasses(await fetchClassCounts(s.id));
      }
    } catch (e: any) {
      setSession(null);
      showError(e.message);
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      loadClasses();
    }, [loadClasses]),
  );

  const back = useCallback(() => {
    if (step === 'done') {
      setStep('classes');
      setSource(null);
      setSelected(new Set());
      setSelecting(false);
      loadClasses();
    } else if (step === 'destination') {
      setStep('students');
    } else if (step === 'students') {
      if (selecting) {
        setSelecting(false);
        setSelected(new Set());
      } else {
        setStep('classes');
        setSource(null);
      }
    } else {
      navigation.goBack();
    }
  }, [step, selecting, navigation, loadClasses]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: any) => {
      if (step === 'classes') {
        return;
      }
      e.preventDefault();
      back();
    });
    return unsub;
  }, [navigation, step, back]);

  const openClass = async (c: any) => {
    if (!session) {
      return;
    }
    setSource(c);
    setStep('students');
    setSelecting(false);
    setSelected(new Set());
    try {
      setRoster(await fetchClassRoster(c.id, session.id));
    } catch (e: any) {
      showError(e.message);
      setRoster([]);
    }
  };

  const tapStudent = (s: any) => {
    if (selecting) {
      const next = new Set(selected);
      if (next.has(s.id)) {
        next.delete(s.id);
      } else {
        next.add(s.id);
      }
      if (next.size === 0) {
        setSelecting(false);
      }
      setSelected(next);
    } else {
      setSingle(s);
    }
  };

  const longPress = (s: any) => {
    setSelecting(true);
    setSelected(new Set([s.id]));
  };

  const migrate = async (target: any) => {
    if (!session) {
      return;
    }
    setBusy(true);
    try {
      if (mode === 'single' && single) {
        await moveStudent(single.id, target.id, session.id);
        setDoneMessage(single.full_name + ' has been added to ' + label(target) + '.');
      } else {
        const ids = Array.from(selected);
        for (const id of ids) {
          await moveStudent(id, target.id, session.id);
        }
        setDoneMessage(ids.length + (ids.length === 1 ? ' student has' : ' students have') + ' been added to ' + label(target) + '.');
      }
      setStep('done');
    } catch (e: any) {
      showError('Could not complete the migration right now. ' + (e.message || ''));
    }
    setBusy(false);
  };

  if (ctxLoading || session === undefined) {
    return (
      <Screen>
        <Skeleton height={160} radius={20} />
      </Screen>
    );
  }

  if (ctx && !ctx.isAdmin) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Admins only" message="Only the school owner and teacher admins can migrate students." />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <EmptyState icon="calendar" title="No current session set" message="Set a current session in Sessions and Terms first." />
      </Screen>
    );
  }

  const classCard = (c: any, onPress: () => void) => (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.chip}>
          <Icon name="cap" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.h3, { color: colors.text }]}>{label(c)}</Text>
          <Text style={[text.small, { color: colors.textMuted }]}>{c.count + (c.count === 1 ? ' student' : ' students')}</Text>
        </View>
        <Icon name="chevron" size={20} color={colors.textMuted} />
      </View>
    </Card>
  );

  if (step === 'classes') {
    return (
      <Screen padded={false}>
        <FlatList
          data={classes}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListHeaderComponent={<Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>Pick the class the students are in now. Moving students into a class in a new session is Student Promotion instead.</Text>}
          ListEmptyComponent={<EmptyState icon="cap" title="No classes yet" message="Create classes for this session first." />}
          renderItem={({ item }) => classCard(item, () => openClass(item))}
        />
      </Screen>
    );
  }

  if (step === 'students') {
    return (
      <Screen padded={false}>
        <FlatList
          data={roster}
          keyExtractor={s => s.id}
          contentContainerStyle={[styles.list, { paddingBottom: selecting ? 120 : spacing.xxxl }]}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.md }}>
              <Text style={[text.h2, { color: colors.primary }]}>{label(source)}</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>Tap a student to move them, or press and hold to select several.</Text>
            </View>
          }
          ListEmptyComponent={<EmptyState icon="users" title="No students in this class" />}
          renderItem={({ item, index }) => {
            const on = selected.has(item.id);
            return (
              <Pressable onPress={() => tapStudent(item)} onLongPress={() => longPress(item)} delayLongPress={450} style={[styles.student, on && { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
                <Text style={[text.caption, { color: colors.textMuted, width: 26 }]}>{index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[text.bodyStrong, { color: colors.text }]} numberOfLines={1}>{item.full_name}</Text>
                  <Text style={[text.small, { color: colors.textMuted }]}>{item.admission_no || ''}</Text>
                </View>
                {selecting ? (
                  <View style={[styles.check, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>{on ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}</View>
                ) : null}
              </Pressable>
            );
          }}
        />
        {selecting ? (
          <View style={styles.bar}>
            <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]}>{selected.size + ' selected'}</Text>
            <Button
              title={selected.size === roster.length ? 'Deselect all' : 'Select all'}
              variant="soft"
              onPress={() => setSelected(selected.size === roster.length ? new Set() : new Set(roster.map(r => r.id)))}
              style={{ height: 44, paddingHorizontal: 14 }}
            />
            <Button
              title="Migrate"
              onPress={() => {
                setMode('bulk');
                setStep('destination');
              }}
              style={{ height: 44, paddingHorizontal: 18 }}
            />
          </View>
        ) : null}
        <BottomSheet visible={!!single} onClose={() => setSingle(null)} title={single ? 'Migrate ' + single.full_name + '?' : ''}>
          <Text style={[text.body, { color: colors.textMuted, marginBottom: spacing.xl }]}>Choose the class to move this student into next.</Text>
          <Button
            title="Yes, choose class"
            onPress={() => {
              setMode('single');
              setStep('destination');
            }}
          />
          <Button title="Cancel" variant="soft" onPress={() => setSingle(null)} style={{ marginTop: spacing.md }} />
        </BottomSheet>
      </Screen>
    );
  }

  if (step === 'destination') {
    const targets = classes.filter(c => c.id !== source.id);
    return (
      <Screen padded={false}>
        <FlatList
          data={targets}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[text.h2, { color: colors.primary }]}>Move to which class?</Text>
              <Text style={[text.small, { color: colors.textMuted }]}>
                {mode === 'single' && single ? 'Moving ' + single.full_name + ' out of ' + label(source) + '.' : 'Moving ' + selected.size + ' student(s) out of ' + label(source) + '.'}
              </Text>
            </View>
          }
          ListEmptyComponent={<EmptyState icon="cap" title="No other classes to move to" />}
          renderItem={({ item }) => <View style={busy ? { opacity: 0.5 } : undefined} pointerEvents={busy ? 'none' : 'auto'}>{classCard(item, () => migrate(item))}</View>}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.done}>
        <View style={styles.doneIcon}>
          <Icon name="check" size={40} color="#FFFFFF" strokeWidth={2.6} />
        </View>
        <Text style={[text.h2, { color: colors.text, marginTop: spacing.lg }]}>Migration complete</Text>
        <Text style={[text.body, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm }]}>{doneMessage}</Text>
        <Button title="Back to classes" onPress={back} style={{ alignSelf: 'stretch', marginTop: spacing.xl }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chip: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  student: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: '#C9CDD4', alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, padding: spacing.lg, paddingBottom: 28, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  doneIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
});
