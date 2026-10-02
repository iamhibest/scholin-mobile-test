import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BottomSheet, Button, Card, Icon, Notice, Screen, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { confirmAction } from '../lib/confirm';
import { fetchFeeGate, fetchPublishState, releaseManually, setPublishState } from '../lib/portal';

function naira(n: any) {
  return '\u20A6' + Number(n || 0).toLocaleString();
}

export default function PublishReportsScreen({ navigation, route }: any) {
  const { classId, termId, termName, sessionName, className } = route.params;
  const { ctx } = useStaff();
  const [state, setState] = useState<{ published: boolean; at: string | null } | null>(null);
  const [fees, setFees] = useState<any[] | null>(null);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  const load = useCallback(async () => {
    if (!ctx) {
      return;
    }
    try {
      setState(await fetchPublishState(classId, termId));
      setFees(await fetchFeeGate(ctx.schoolId, classId, termId));
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
      setState({ published: false, at: null });
    }
  }, [ctx, classId, termId]);

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: 'Publish Report Cards' });
      load();
    }, [load, navigation]),
  );

  const change = async (publish: boolean) => {
    if (!ctx) {
      return;
    }
    setBusy(true);
    try {
      await setPublishState({ classId, termId, publish, userId: ctx.userId, schoolId: ctx.schoolId, className, termName, sessionName });
      setSheet(false);
      await load();
      setNotice({
        message: publish ? 'Report cards published. Parents can now see them for this term.' : 'Report cards unpublished. Parents can no longer see them for this term.',
        tone: 'success',
      });
    } catch (e: any) {
      setSheet(false);
      setNotice({ message: e.message, tone: 'error' });
    }
    setBusy(false);
  };

  const release = (student: any) => {
    confirmAction('Release anyway', "Release " + student.full_name + "'s report card to their parent now, even though they have an outstanding balance?", 'Release', async () => {
      if (!ctx) {
        return;
      }
      try {
        await releaseManually(student.id, termId, ctx.userId);
        await load();
      } catch (e: any) {
        setNotice({ message: e.message, tone: 'error' });
      }
    }, false);
  };

  if (!state) {
    return (
      <Screen>
        <Skeleton height={180} radius={24} />
      </Screen>
    );
  }

  const published = state.published;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>{className + '  |  ' + termName + ', ' + sessionName}</Text>
        <Notice message={notice.message} tone={notice.tone} />
        <Card style={styles.status}>
          <View style={[styles.circle, { backgroundColor: published ? colors.successSoft : colors.accentSoft }]}>
            <Icon name={published ? 'check' : 'send'} size={32} color={published ? colors.success : colors.accentDark} />
          </View>
          <Text style={[text.h2, { color: published ? colors.success : colors.text, marginTop: spacing.lg }]}>{published ? 'Published to parents' : 'Not published yet'}</Text>
          <Text style={[text.small, styles.sub]}>
            {published ? (state.at ? 'Published on ' + new Date(state.at).toLocaleDateString() : '') : "Parents cannot see this class's report cards for this term yet."}
          </Text>
          {published ? (
            <Button title="Unpublish" variant="danger" onPress={() => confirmAction('Unpublish report cards', 'Parents will no longer be able to see this class\'s report cards for this term.', 'Unpublish', () => change(false))} style={styles.action} />
          ) : (
            <Button title="Publish to parents" icon="send" onPress={() => setSheet(true)} style={styles.action} />
          )}
        </Card>

        {fees ? (
          <View style={{ marginTop: spacing.xl }}>
            <Text style={[text.h3, { color: colors.text }]}>Fee status</Text>
            <Text style={[text.small, styles.sub, { textAlign: 'left', marginBottom: spacing.md }]}>This school holds report cards back until fees are paid. Release a card early if needed.</Text>
            {fees.length === 0 ? <Text style={[text.body, { color: colors.textMuted }]}>No students in this class.</Text> : null}
            {fees.map(({ student, status }) => {
              const locked = !status.unlocked;
              const outstanding = status.outstanding || [];
              return (
                <Card key={student.id} style={styles.feeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[text.bodyStrong, { color: colors.text }]}>{student.full_name}</Text>
                    <Text style={[text.small, { color: locked ? colors.danger : colors.success, marginTop: 2 }]}>
                      {locked ? outstanding.map((o: any) => o.name + ' (' + naira(o.balance) + ')').join(', ') : status.manually_released ? 'Manually released' : 'Fees paid'}
                    </Text>
                  </View>
                  {locked ? <Button title="Release" variant="soft" onPress={() => release(student)} style={{ height: 40, paddingHorizontal: 14 }} /> : null}
                </Card>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <BottomSheet visible={sheet} onClose={() => setSheet(false)} title="Publish report cards">
        <Text style={[text.body, { color: colors.textMuted, marginBottom: spacing.xl }]}>{"Parents will be able to see this class's report cards for " + termName + '. Make sure scores and comments are final.'}</Text>
        <Button title="Publish now" loading={busy} onPress={() => change(true)} />
        <Button title="Cancel" variant="soft" onPress={() => setSheet(false)} style={{ marginTop: spacing.md }} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  status: { alignItems: 'center', paddingVertical: spacing.xl },
  circle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  sub: { color: colors.textMuted, textAlign: 'center', marginTop: 4 },
  action: { alignSelf: 'stretch', marginTop: spacing.xl },
  feeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, padding: spacing.md },
});
