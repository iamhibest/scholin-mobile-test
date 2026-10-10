import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, EmptyState, Screen, Skeleton } from '../components';
import { colors, radius, spacing, text } from '../theme';
import { ChildWish, fetchChildBirthdayWishes, parentGreeting } from '../lib/birthdayWishes';

// The full birthday greeting a parent reads, written as if it came from the school.
export default function ParentBirthdayWishScreen() {
  const [wishes, setWishes] = useState<ChildWish[] | null>(null);

  useEffect(() => {
    fetchChildBirthdayWishes().then(setWishes).catch(() => setWishes([]));
  }, []);

  if (wishes === null) {
    return (
      <Screen>
        <Skeleton height={260} radius={24} />
      </Screen>
    );
  }
  if (wishes.length === 0) {
    return (
      <Screen>
        <EmptyState icon="calendar" title="No birthday today" message="A birthday wish from the school shows here on your child's birthday." />
      </Screen>
    );
  }
  const g = parentGreeting(wishes);
  return (
    <Screen scroll>
      <View style={styles.card}>
        <Text style={[text.caption, { color: '#8A5A00', letterSpacing: 1 }]}>A BIRTHDAY WISH FROM THE SCHOOL</Text>
        <Text style={[text.h2, { color: colors.text, marginTop: 8 }]}>{g.title}</Text>
        <Text style={[text.body, { color: colors.text, marginTop: spacing.lg, lineHeight: 24 }]}>{g.body}</Text>
        <Text style={[text.body, { color: colors.text, marginTop: spacing.lg }]}>With love and best wishes,</Text>
        <Text style={[text.bodyStrong, { color: colors.text, marginTop: 4 }]}>{g.from}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFF8E1', borderRadius: radius.lg, borderWidth: 1, borderColor: '#F5D27A', padding: spacing.xl },
});
