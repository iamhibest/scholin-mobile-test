import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, EmptyState, Icon, Screen, Skeleton } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { useBirthdays } from '../lib/useBirthdays';
import { staffAdvice } from '../lib/birthdayWishes';

// What the school sees when it taps the birthday banner: who is celebrating, a greeting, and what to do about it.
export default function BirthdayWishScreen({ navigation }: any) {
  const { ctx, loading } = useStaff();
  const { summary } = useBirthdays(ctx ? ctx.schoolId : undefined);

  if (loading || !summary) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={120} radius={20} />
          <Skeleton height={160} radius={20} />
        </View>
      </Screen>
    );
  }

  const isToday = summary.today.length > 0;
  const list = isToday ? summary.today : summary.tomorrow;
  if (list.length === 0) {
    return (
      <Screen>
        <EmptyState icon="calendar" title="No birthday today or tomorrow" message="When a student is celebrating, you will see a greeting and ideas on how to celebrate them here." />
        <Button title="See all birthdays" variant="soft" onPress={() => navigation.replace('Birthdays')} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  const advice = staffAdvice(list.length, isToday);
  return (
    <Screen scroll>
      <View style={[styles.hero, { backgroundColor: isToday ? '#FFF1C9' : '#FFE6EC', borderColor: isToday ? '#F5D27A' : '#F9C0CD' }]}>
        <Text style={[text.caption, { color: isToday ? '#8A5A00' : '#E11D48', letterSpacing: 1 }]}>{isToday ? 'CELEBRATING TODAY' : 'CELEBRATING TOMORROW'}</Text>
        <Text style={[text.h2, { color: colors.text, marginTop: 6 }]}>{isToday ? 'Happy Birthday!' : 'Birthday Reminder'}</Text>
        <View style={{ marginTop: spacing.md, gap: 8 }}>
          {list.map(b => (
            <View key={b.id} style={styles.nameRow}>
              <View style={styles.dot}><Text style={[text.bodyStrong, { color: colors.primary }]}>{b.name.charAt(0).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={[text.bodyStrong, { color: colors.text }]}>{b.name}</Text>
                <Text style={[text.small, { color: colors.textMuted }]}>{b.dateLabel + ', turning ' + b.turning}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <Card style={{ marginTop: spacing.lg }}>
        <Text style={[text.bodyStrong, { color: colors.text }]}>{advice.wish}</Text>
        <Text style={[text.h3, { color: colors.text, marginTop: spacing.lg }]}>How you can celebrate</Text>
        <View style={{ marginTop: spacing.sm, gap: spacing.md }}>
          {advice.tips.map((t, i) => (
            <View key={i} style={styles.tip}>
              <Icon name="check" size={16} color={colors.success} />
              <Text style={[text.body, { color: colors.text, flex: 1 }]}>{t}</Text>
            </View>
          ))}
        </View>
      </Card>

      {isToday ? (
        <View style={styles.sent}>
          <Icon name="check" size={18} color={colors.success} />
          <Text style={[text.small, { color: colors.text, flex: 1 }]}>
            A birthday wish has been sent to the parent platform on behalf of the school. Linked parents see it on their dashboard today.
          </Text>
        </View>
      ) : (
        <View style={styles.sent}>
          <Icon name="info" size={18} color={colors.primary} />
          <Text style={[text.small, { color: colors.text, flex: 1 }]}>Tomorrow, a birthday wish will be sent to the parent platform on behalf of the school.</Text>
        </View>
      )}

      <Button title="See all birthdays" variant="soft" onPress={() => navigation.navigate('Birthdays')} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  sent: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.successSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.lg },
});
