import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Share from 'react-native-share';
import { Button, Card, EmptyState, Notice, Screen, Skeleton } from '../components';
import { colors, fonts, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { dayParts, fetchAttendanceMode } from '../lib/attendance';
import { fetchSummary, setCalculatedAttendance } from '../lib/portal';

function num(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(input: string) {
  const bytes: number[] = [];
  const utf8 = unescape(encodeURIComponent(input));
  for (let i = 0; i < utf8.length; i++) {
    bytes.push(utf8.charCodeAt(i));
  }
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += B64[a >> 2] + B64[((a & 3) << 4) | ((b || 0) >> 4)];
    out += b === undefined ? '=' : B64[((b & 15) << 2) | ((c || 0) >> 6)];
    out += c === undefined ? '=' : B64[c & 63];
  }
  return out;
}

export default function AttendanceSummaryScreen({ navigation, route }: any) {
  const { classId, sessionId, termId, termName, className } = route.params;
  const { ctx } = useStaff();
  const [data, setData] = useState<any>(null);
  const [calculated, setCalculated] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' }>({ message: '', tone: 'success' });

  useEffect(() => {
    navigation.setOptions({ title: 'Weekly Summary' });
    if (!ctx) {
      return;
    }
    fetchAttendanceMode(ctx.schoolId)
      .then(mode => fetchSummary(classId, termId, sessionId, ctx.schoolId, mode))
      .then(d => {
        setData(d);
        setCalculated(d.calculated);
      })
      .catch(e => {
        setData({ roster: [], weekData: [] });
        setNotice({ message: e.message, tone: 'error' });
      });
  }, [ctx, classId, termId, sessionId, navigation]);

  const flip = async (v: boolean) => {
    setCalculated(v);
    try {
      await setCalculatedAttendance(classId, termId, v);
    } catch (e: any) {
      setCalculated(!v);
      setNotice({ message: e.message, tone: 'error' });
    }
  };

  if (!data) {
    return (
      <Screen>
        <Skeleton height={260} radius={20} />
      </Screen>
    );
  }

  const { roster, weekData } = data;
  const totalPossible = weekData.reduce((sum: number, w: any) => sum + w.daysOpen, 0) * 2;

  const exportCsv = async () => {
    const head = ['Student', 'Admission No.', ...weekData.map((w: any) => 'Week of ' + w.weekStart + ' (of ' + w.daysOpen * 2 + ')'), 'Total Present', 'Total Absent'];
    const rows = [head];
    roster.forEach((s: any) => {
      let present = 0;
      const row = [s.full_name, s.admission_no || ''];
      weekData.forEach((w: any) => {
        const p = w.perStudent[s.id] || 0;
        present += p;
        row.push(num(p) + '/' + w.daysOpen * 2);
      });
      row.push(num(present), num(Math.max(0, totalPossible - present)));
      rows.push(row);
    });
    const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    try {
      await Share.open({
        url: 'data:text/csv;base64,' + toBase64('\ufeff' + csv),
        filename: (className + '_' + termName + '_Attendance').replace(/\s+/g, '_'),
        type: 'text/csv',
        failOnCancel: false,
      });
    } catch (e: any) {
      setNotice({ message: 'Could not export attendance: ' + (e.message || e), tone: 'error' });
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[text.small, { color: colors.textMuted, marginBottom: spacing.lg }]}>{className + '  |  ' + termName}</Text>
        <Notice message={notice.message} tone={notice.tone} />
        <Card style={styles.toggle}>
          <View style={{ flex: 1 }}>
            <Text style={[text.bodyStrong, { color: colors.text }]}>Use calculated attendance</Text>
            <Text style={[text.small, { color: colors.textMuted }]}>Report cards use the days present worked out from this register instead of a typed number.</Text>
          </View>
          <Switch value={calculated} onValueChange={flip} trackColor={{ false: '#D5D8DE', true: colors.primaryLight }} thumbColor={calculated ? colors.primary : '#FFFFFF'} />
        </Card>

        {weekData.length === 0 ? (
          <EmptyState icon="calendar" title="No weeks set up yet" message="Open the Register, set the days open for a week and start marking." />
        ) : roster.length === 0 ? (
          <EmptyState icon="users" title="No students in this class yet" />
        ) : (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.table}>
                <View style={[styles.tr, styles.th]}>
                  <Text style={[styles.cell, styles.nameCell, styles.thText]}>Student</Text>
                  {weekData.map((w: any) => (
                    <Text key={w.weekStart} style={[styles.cell, styles.thText]}>{dayParts(w.weekStart).day + ' ' + dayParts(w.weekStart).month + '\nof ' + w.daysOpen * 2}</Text>
                  ))}
                  <Text style={[styles.cell, styles.thText]}>Present</Text>
                  <Text style={[styles.cell, styles.thText]}>Absent</Text>
                </View>
                {roster.map((s: any, i: number) => {
                  let present = 0;
                  return (
                    <View key={s.id} style={[styles.tr, i % 2 === 1 && { backgroundColor: colors.background }]}>
                      <Text style={[styles.cell, styles.nameCell, { color: colors.text }]} numberOfLines={1}>{s.full_name}</Text>
                      {weekData.map((w: any) => {
                        const p = w.perStudent[s.id] || 0;
                        present += p;
                        return <Text key={w.weekStart} style={[styles.cell, { color: colors.text }]}>{num(p) + '/' + w.daysOpen * 2}</Text>;
                      })}
                      <Text style={[styles.cell, { color: colors.success, fontFamily: fonts.bold }]}>{num(present)}</Text>
                      <Text style={[styles.cell, { color: colors.danger, fontFamily: fonts.bold }]}>{num(Math.max(0, totalPossible - present))}</Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <Button title="Export as CSV" variant="soft" onPress={exportCsv} style={{ marginTop: spacing.xl }} />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  table: { borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  tr: { flexDirection: 'row', alignItems: 'center' },
  th: { backgroundColor: colors.primary },
  cell: { width: 74, paddingVertical: 12, paddingHorizontal: 6, textAlign: 'center', fontFamily: fonts.medium, fontSize: 13 },
  nameCell: { width: 150, textAlign: 'left', paddingLeft: 12 },
  thText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 12 },
});
