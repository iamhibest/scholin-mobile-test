import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import ScrollView from '../components/KeyboardAwareScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, EmptyState, Notice, OptionField, Screen, Skeleton } from '../components';
import { colors, fonts, radius, shadow, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { fetchClassRoster } from '../lib/school';
import { fetchAllClassNames, fetchCommentData, fetchTraits, saveCommentData, suggestComment } from '../lib/portal';

const RATINGS = ['Excellent', 'Very Good', 'Good', 'Fair', 'Poor'].map(r => ({ value: r, label: r }));

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={[text.caption, styles.label]}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} multiline textAlignVertical="top" style={styles.area} placeholderTextColor="#9CA3AF" />
    </View>
  );
}

export default function ClassCommentsScreen({ navigation, route }: any) {
  const { classId, sessionId, termId, className } = route.params;
  const { ctx } = useStaff();
  const insets = useSafeAreaInsets();
  const [students, setStudents] = useState<any[] | null>(null);
  const [traits, setTraits] = useState<{ cognitive: any[]; character: any[] }>({ cognitive: [], character: [] });
  const [classNames, setClassNames] = useState<string[]>([]);
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState('0');
  const [present, setPresent] = useState('');
  const [ct, setCt] = useState('');
  const [ht, setHt] = useState('');
  const [pr, setPr] = useState('');
  const [promoted, setPromoted] = useState('');
  const [hint, setHint] = useState('');
  const presentRef = useRef<TextInput>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  useEffect(() => {
    navigation.setOptions({ title: 'Comments and Ratings' });
  }, [navigation]);

  useEffect(() => {
    if (!ctx) {
      return;
    }
    Promise.all([fetchClassRoster(classId, sessionId), fetchTraits(ctx.schoolId), fetchAllClassNames(ctx.schoolId)])
      .then(([r, t, names]) => {
        setStudents(r);
        setTraits(t);
        setClassNames(names);
      })
      .catch(e => {
        setStudents([]);
        setNotice({ message: e.message, tone: 'error' });
      });
  }, [ctx, classId, sessionId]);

  const choose = async (id: string) => {
    setStudentId(id);
    setNotice({ message: '', tone: 'success' });
    setHint('');
    if (!id) {
      return;
    }
    setLoading(true);
    try {
      const d = await fetchCommentData(id, termId);
      const map: Record<string, string> = {};
      [...traits.cognitive, ...traits.character].forEach(t => {
        map[t.id] = d.ratingMap[t.id] || 'Excellent';
      });
      setRatings(map);
      setOpened(String(d.daysOpened || 0));
      setPresent(d.daysPresent === null || d.daysPresent === undefined ? '' : String(d.daysPresent));
      setCt(d.remarks ? d.remarks.class_teacher_remark || '' : '');
      setHt(d.remarks ? d.remarks.head_teacher_remark || '' : '');
      setPr(d.remarks ? d.remarks.principal_remark || '' : '');
      setPromoted(d.remarks ? d.remarks.promoted_to || '' : '');
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setLoading(false);
  };

  const suggest = async () => {
    if (!ctx) {
      return;
    }
    setHint('Calculating');
    try {
      const r = await suggestComment(ctx.schoolId, classId, termId, studentId);
      if (r.band) {
        setCt(r.band.class_teacher_text || '');
        setHt(r.band.head_teacher_text || '');
        setPr(r.band.principal_text || '');
      }
      setHint(r.message);
    } catch (e: any) {
      setHint(e.message);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveCommentData({
        studentId,
        termId,
        ratings,
        daysOpened: parseInt(opened, 10) || 0,
        daysPresent: parseInt(present, 10) || 0,
        classTeacher: ct,
        headTeacher: ht,
        principal: pr,
        promotedTo: promoted,
      });
      setNotice({ message: 'Saved.', tone: 'success' });
    } catch (e: any) {
      setNotice({ message: e.message, tone: 'error' });
    }
    setSaving(false);
  };

  if (!students) {
    return (
      <Screen>
        <Skeleton height={60} radius={16} />
      </Screen>
    );
  }

  const traitCard = (title: string, list: any[]) => (
    <Card style={styles.card}>
      <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>{title}</Text>
      {list.map(t => (
        <View key={t.id} style={styles.traitRow}>
          <Text style={[text.body, { color: colors.text, flex: 1 }]}>{t.name}</Text>
          <View style={{ width: 150 }}>
            <OptionField compact label="" value={ratings[t.id] || 'Excellent'} options={RATINGS} onChange={v => setRatings(r => ({ ...r, [t.id]: v }))} />
          </View>
        </View>
      ))}
    </Card>
  );

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 120 + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>{className}</Text>
        {students.length === 0 ? (
          <EmptyState icon="users" title="No students in this class yet" message="Your school admin needs to assign students to this class first." />
        ) : (
          <OptionField label="Student" value={studentId} options={students.map(s => ({ value: s.id, label: s.full_name }))} placeholder="Select a student" onChange={choose} />
        )}
        <Notice message={notice.message} tone={notice.tone} />
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} /> : null}

        {studentId && !loading ? (
          <View>
            {traitCard('Cognitive Skills', traits.cognitive)}
            {traitCard('Character and Conduct', traits.character)}
            <Card style={styles.card}>
              <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Attendance</Text>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={[text.caption, styles.label]}>Days school opened</Text>
                  <TextInput value={opened} onChangeText={setOpened} keyboardType="number-pad" returnKeyType="next" blurOnSubmit={false} onSubmitEditing={() => presentRef.current && presentRef.current.focus()} style={styles.num} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[text.caption, styles.label]}>Days present</Text>
                  <TextInput ref={presentRef} value={present} onChangeText={setPresent} keyboardType="number-pad" returnKeyType="done" style={styles.num} />
                </View>
              </View>
            </Card>
            <Card style={styles.card}>
              <Text style={[text.h3, { color: colors.text, marginBottom: spacing.md }]}>Remarks and Promotion</Text>
              <Button title="Apply suggested comments" variant="soft" onPress={suggest} style={{ height: 46 }} />
              {hint ? <Text style={[text.small, { color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.sm }]}>{hint}</Text> : <View style={{ height: spacing.md }} />}
              <Area label="Class teacher's remark" value={ct} onChange={setCt} />
              <Area label="Head teacher's remark" value={ht} onChange={setHt} />
              <Area label="Principal's remark" value={pr} onChange={setPr} />
              <OptionField
                label="Promoted to (typically set on 3rd term)"
                value={promoted}
                options={[{ value: '', label: 'Not set' }, ...classNames.map(n => ({ value: n, label: n }))]}
                placeholder="Not set"
                onChange={setPromoted}
              />
            </Card>
          </View>
        ) : null}
      </ScrollView>
      {studentId && !loading ? (
        <View style={[styles.bar, shadow.raised, { paddingBottom: Math.max(insets.bottom, 12) + 4 }]}>
          <Button title="Save" loading={saving} onPress={save} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  card: { marginBottom: spacing.lg },
  label: { color: colors.textMuted, marginBottom: 6 },
  traitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  num: { height: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 17, color: colors.text, paddingVertical: 0 },
  area: { minHeight: 96, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, fontFamily: fonts.body, fontSize: 15, color: colors.text },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, paddingHorizontal: spacing.xl, paddingTop: spacing.md, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
});
