import React, { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BottomSheet, Badge, Button, Card, DateField, EmptyState, Icon, Input, Notice, Screen, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { useChain } from '../lib/useChain';
import { confirmAction, showError } from '../lib/confirm';
import { isoToDisplay } from '../lib/date';
import {
  addComponent,
  addSession,
  deleteComponent,
  deleteSession,
  fetchSessionsWithTerms,
  makeSessionCurrent,
  makeTermCurrent,
  renameSession,
  saveTerm,
  setArchived,
} from '../lib/admin';
import { fetchComponents } from '../lib/portal';

export default function SessionsTermsScreen() {
  const { ctx, loading: ctxLoading } = useStaff();
  const [sessions, setSessions] = useState<any[] | null>(null);
  const [newName, setNewName] = useState('');
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });
  const [termSheet, setTermSheet] = useState<{ sessionId: string; term: any | null } | null>(null);
  const [tName, setTName] = useState('');
  const [tEnd, setTEnd] = useState('');
  const [tResume, setTResume] = useState('');
  const [tDays, setTDays] = useState('');
  const termChain = useChain(2);
  const [sessionSheet, setSessionSheet] = useState<any>(null);
  const [sName, setSName] = useState('');
  const [compTerm, setCompTerm] = useState<any>(null);
  const [comps, setComps] = useState<any[]>([]);
  const [cName, setCName] = useState('');
  const [cMax, setCMax] = useState('');
  const [deleting, setDeleting] = useState<any>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      setSessions(await fetchSessionsWithTerms(ctx.schoolId, false));
    } catch (e: any) {
      setSessions([]);
      setNotice({ message: e.message, tone: 'error' });
    }
  }, [ctx]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const run = async (job: () => Promise<any>) => {
    try {
      await job();
      await load();
    } catch (e: any) {
      showError(e.message);
    }
  };

  const add = async () => {
    if (!ctx) {
      return;
    }
    if (!newName.trim()) {
      setNotice({ message: 'Session name is required.', tone: 'error' });
      return;
    }
    try {
      await addSession(ctx.schoolId, newName.trim());
      setNewName('');
      setNotice({ message: '', tone: 'success' });
      await load();
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
  };

  const makeCurrent = (s: any) => {
    if (!ctx) {
      return;
    }
    Alert.alert(
      'Make session current',
      'Also auto promote students from the last session based on their Promoted To setting on their report cards? Students without one are left for you to assign in Student Promotion.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Make current only',
          onPress: () => run(() => makeSessionCurrent(ctx.schoolId, s.id, false)),
        },
        {
          text: 'Make current and promote',
          onPress: async () => {
            try {
              const r: any = await makeSessionCurrent(ctx.schoolId, s.id, true);
              if (r && r.total > 0) {
                Alert.alert('Promotion complete', r.promoted + ' student(s) moved into their new class.' + (r.skipped > 0 ? '\n\n' + r.skipped + ' still need manual assignment in Student Promotion.' : ''));
              }
              await load();
            } catch (e: any) {
              showError(e.message);
            }
          },
        },
      ],
    );
  };

  const openTerm = (sessionId: string, term: any | null) => {
    setTermSheet({ sessionId, term });
    setTName(term ? term.name || '' : '');
    setTEnd(term && term.term_end_date ? String(term.term_end_date).slice(0, 10) : '');
    setTResume(term && term.next_term_resumes ? String(term.next_term_resumes).slice(0, 10) : '');
    setTDays(term ? String(term.days_school_opened || 0) : '');
  };

  const saveTermNow = async () => {
    if (!termSheet) {
      return;
    }
    if (!tName.trim()) {
      showError('Term name is required.');
      return;
    }
    setBusy(true);
    try {
      await saveTerm(termSheet.sessionId, termSheet.term ? termSheet.term.id : null, { name: tName, end: tEnd, resume: tResume, days: tDays });
      setTermSheet(null);
      await load();
    } catch (e: any) {
      showError(e.message);
    }
    setBusy(false);
  };

  const saveSessionName = async () => {
    if (!sessionSheet) {
      return;
    }
    if (!sName.trim()) {
      showError('Session name is required.');
      return;
    }
    setBusy(true);
    try {
      await renameSession(sessionSheet.id, sName.trim());
      setSessionSheet(null);
      await load();
    } catch (e: any) {
      showError(e.message);
    }
    setBusy(false);
  };

  const openComps = async (term: any) => {
    setCompTerm(term);
    setCName('');
    setCMax('');
    try {
      setComps(await fetchComponents(term.id));
    } catch (e: any) {
      showError(e.message);
    }
  };

  const addComp = async () => {
    if (!ctx || !compTerm) {
      return;
    }
    const max = parseFloat(cMax);
    if (!cName.trim() || !max) {
      showError('Please enter a component name and max score.');
      return;
    }
    try {
      await addComponent(ctx.schoolId, compTerm.id, cName.trim(), max);
      setCName('');
      setCMax('');
      setComps(await fetchComponents(compTerm.id));
    } catch (e: any) {
      showError(e.message);
    }
  };

  const removeComp = (c: any) => {
    confirmAction('Remove component', 'Remove this assessment component? Any scores recorded under it will also be removed.', 'Remove', async () => {
      try {
        await deleteComponent(c.id);
        setComps(await fetchComponents(compTerm.id));
      } catch (e: any) {
        showError(e.message);
      }
    });
  };

  const confirmDelete = async () => {
    if (!deleting) {
      return;
    }
    setBusy(true);
    try {
      await deleteSession(deleting.id);
      setDeleting(null);
      await load();
    } catch (e: any) {
      showError(e.message);
    }
    setBusy(false);
  };

  if (ctxLoading || !sessions) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={120} radius={20} />
          <Skeleton height={160} radius={20} />
        </View>
      </Screen>
    );
  }

  if (ctx && !ctx.isAdmin) {
    return (
      <Screen>
        <EmptyState icon="shield" title="Admins only" message="Only the school owner and teacher admins can manage sessions and terms." />
      </Screen>
    );
  }

  const total = comps.reduce((sum, c) => sum + parseFloat(String(c.max_score)), 0);

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card style={{ marginBottom: spacing.lg }}>
          <Input label="New session" value={newName} onChangeText={setNewName} placeholder="e.g. 2026/2027" icon="calendar" returnKeyType="done" onSubmitEditing={add} />
          <Button title="Add session" icon="plus" onPress={add} />
        </Card>
        <Notice message={notice.message} tone={notice.tone} />

        {sessions.length === 0 ? <EmptyState icon="calendar" title="No sessions yet" message="Add your first session above to get started." /> : null}

        {sessions.map(s => (
          <Card key={s.id} style={styles.block}>
            <View style={styles.head}>
              <Text style={[text.h3, { color: colors.text, flex: 1 }]}>{s.name}</Text>
              {s.is_current ? <Badge label="Current" tone="green" /> : null}
            </View>
            <View style={styles.actions}>
              <Button
                title="Edit"
                icon="edit"
                variant="soft"
                style={styles.action}
                onPress={() => {
                  setSessionSheet(s);
                  setSName(s.name);
                }}
              />
              {!s.is_current ? <Button title="Make current" variant="outline" style={styles.action} onPress={() => makeCurrent(s)} /> : null}
              <Button title="Add term" icon="plus" variant="outline" style={styles.action} onPress={() => openTerm(s.id, null)} />
              <Button
                title="Archive"
                variant="outline"
                style={styles.action}
                onPress={() => confirmAction('Archive session', 'Archive this session? It will be hidden from the main view but all data stays safe. You can unarchive it from Archived Sessions.', 'Archive', () => run(() => setArchived(s.id, true)), false)}
              />
              <Button
                title="Delete"
                icon="trash"
                variant="danger"
                style={[styles.action, { flexBasis: '100%' }]}
                onPress={() => {
                  setDeleting(s);
                  setTyped('');
                }}
              />
            </View>

            {s.terms.length === 0 ? <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.md }]}>No terms yet for this session.</Text> : null}
            {s.terms.map((t: any) => (
              <View key={t.id} style={styles.term}>
                <View style={styles.head}>
                  <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]}>{t.name}</Text>
                  {t.is_current ? <Badge label="Current" tone="green" /> : null}
                </View>
                <Text style={[text.small, { color: colors.textMuted, marginTop: 2 }]}>
                  {'Days school opened: ' + (t.days_school_opened || 0) + (t.term_end_date ? '  |  Ends ' + isoToDisplay(t.term_end_date) : '') + (t.next_term_resumes ? '  |  Resumes ' + isoToDisplay(t.next_term_resumes) : '')}
                </Text>
                <View style={styles.actions}>
                  <Button title="Edit" variant="soft" style={styles.smallAction} onPress={() => openTerm(s.id, t)} />
                  {!t.is_current ? <Button title="Make current" variant="outline" style={styles.smallAction} onPress={() => run(() => makeTermCurrent(t.id, s.id))} /> : null}
                  <Button title="Assessment structure" variant="outline" style={styles.smallAction} onPress={() => openComps(t)} />
                </View>
              </View>
            ))}
          </Card>
        ))}
      </ScrollView>

      <BottomSheet visible={!!termSheet} onClose={() => setTermSheet(null)} title={termSheet && termSheet.term ? 'Edit term' : 'Add term'}>
        <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Input {...termChain(0)} label="Term name" value={tName} onChangeText={setTName} placeholder="e.g. First Term" autoCapitalize="words" />
          <DateField label="Term end date (optional)" value={tEnd} onChange={setTEnd} allowFuture placeholder="Select date" />
          <DateField label="Next term resumes (optional)" value={tResume} onChange={setTResume} allowFuture placeholder="Select date" />
          <Input {...termChain(1)} label="Days school opened" value={tDays} onChangeText={setTDays} keyboardType="number-pad" placeholder="0" />
          <Button title="Save" loading={busy} onPress={saveTermNow} />
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={!!sessionSheet} onClose={() => setSessionSheet(null)} title="Edit session">
        <Input label="Session name" value={sName} onChangeText={setSName} returnKeyType="done" onSubmitEditing={saveSessionName} />
        <Button title="Save" loading={busy} onPress={saveSessionName} />
      </BottomSheet>

      <BottomSheet visible={!!compTerm} onClose={() => setCompTerm(null)} title={compTerm ? compTerm.name + ' assessment structure' : ''}>
        <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.md }]}>{comps.length ? 'Total: ' + total + ' points' : 'No components yet. Add one below, for example 1st CA out of 20.'}</Text>
          {comps.map(c => (
            <View key={c.id} style={styles.comp}>
              <Text style={[text.bodyStrong, { color: colors.text, flex: 1 }]}>{c.name + ' (' + c.max_score + ')'}</Text>
              <Button title="Remove" variant="danger" onPress={() => removeComp(c)} style={{ height: 38, paddingHorizontal: 12 }} />
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
            <View style={{ flex: 2 }}>
              <Input label="Component name" value={cName} onChangeText={setCName} placeholder="1st CA" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Max score" value={cMax} onChangeText={setCMax} keyboardType="number-pad" placeholder="20" returnKeyType="done" onSubmitEditing={addComp} />
            </View>
          </View>
          <Button title="Add component" icon="plus" onPress={addComp} />
        </ScrollView>
      </BottomSheet>

      <Modal visible={!!deleting} transparent animationType="fade" onRequestClose={() => setDeleting(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={[text.h3, { color: colors.danger }]}>Delete session</Text>
            <Text style={[text.small, { color: colors.textMuted, marginTop: 6 }]}>
              {'This permanently deletes "' + (deleting ? deleting.name : '') + '" and all its terms, classes, class history, results, attendance and comments. It cannot be undone.\n\nType the session name exactly to confirm:'}
            </Text>
            <TextInput value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} style={styles.typed} placeholder="Session name" placeholderTextColor="#9CA3AF" />
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
              <Button title="Cancel" variant="soft" onPress={() => setDeleting(null)} style={{ flex: 1 }} />
              <Button title="Delete" variant="danger" loading={busy} disabled={!deleting || typed !== deleting.name} onPress={confirmDelete} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  block: { marginBottom: spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  action: { flexGrow: 1, flexBasis: '46%', minWidth: 0, height: 44, paddingHorizontal: 10 },
  smallAction: { flexGrow: 1, flexBasis: '46%', minWidth: 0, height: 42, paddingHorizontal: 10 },
  term: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  comp: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  dialog: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl },
  typed: { marginTop: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, height: 50, color: colors.text, fontSize: 16 },
});
