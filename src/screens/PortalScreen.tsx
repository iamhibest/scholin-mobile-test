import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Badge, Card, EmptyState, Icon, Screen, Skeleton } from '../components';
import { colors, spacing, text } from '../theme';
import { useStaff } from '../lib/useStaff';
import { fetchSessions, fetchTerms } from '../lib/school';

type Mode = 'sessions' | 'terms';

function PickRow({ title, subtitle, current, onPress }: { title: string; subtitle: string; current?: string; onPress: () => void }) {
  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.chip}>
          <Icon name="calendar" size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[text.h3, { color: colors.text }]}>{title}</Text>
          <Text style={[text.small, { color: colors.textMuted }]}>{subtitle}</Text>
          {current ? (
            <View style={{ marginTop: 6 }}>
              <Badge label={current} tone="green" />
            </View>
          ) : null}
        </View>
        <Icon name="chevron" size={20} color={colors.textMuted} />
      </View>
    </Card>
  );
}

export function PortalSessionsScreen({ navigation }: any) {
  const { ctx, loading: ctxLoading } = useStaff();
  const [items, setItems] = useState<any[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ctx) {
      return;
    }
    fetchSessions(ctx.schoolId).then(setItems).catch(() => setFailed(true));
  }, [ctx]);

  return (
    <PortalList
      loading={ctxLoading || (!items && !failed)}
      failed={failed}
      items={items || []}
      emptyTitle="No sessions yet"
      emptyMessage="Your school admin needs to create a session, for example 2025 and 2026, before classes and terms can be set up."
      render={(s: any) => (
        <PickRow title={s.name} subtitle="View terms and classes" current={s.is_current ? 'Current session' : undefined} onPress={() => navigation.navigate('PortalTerms', { sessionId: s.id, sessionName: s.name })} />
      )}
    />
  );
}

export function PortalTermsScreen({ navigation, route }: any) {
  const { sessionId, sessionName } = route.params;
  const [items, setItems] = useState<any[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchTerms(sessionId).then(setItems).catch(() => setFailed(true));
  }, [sessionId]);

  return (
    <PortalList
      loading={!items && !failed}
      failed={failed}
      items={items || []}
      title={sessionName}
      emptyTitle="No terms yet for this session"
      emptyMessage="Your school admin needs to create terms before classes can be added."
      render={(t: any) => (
        <PickRow
          title={t.name}
          subtitle="View classes"
          current={t.is_current ? 'Current term' : undefined}
          onPress={() => navigation.navigate('PortalClasses', { sessionId, sessionName, termId: t.id, termName: t.name })}
        />
      )}
    />
  );
}

function PortalList(props: any) {
  const { loading, failed, items, render, emptyTitle, emptyMessage, title } = props;
  if (loading) {
    return (
      <Screen>
        <View style={{ gap: spacing.md }}>
          <Skeleton height={90} radius={24} />
          <Skeleton height={90} radius={24} />
          <Skeleton height={90} radius={24} />
        </View>
      </Screen>
    );
  }
  return (
    <Screen padded={false}>
      <FlatList
        data={items}
        keyExtractor={(i: any) => i.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={title ? <Text style={[text.h2, styles.title]}>{title}</Text> : null}
        ListEmptyComponent={failed ? <EmptyState icon="info" title="Could not load" message="Check your connection and open this screen again." /> : <EmptyState icon="calendar" title={emptyTitle} message={emptyMessage} />}
        renderItem={({ item }) => render(item)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxxl },
  title: { color: colors.primary, marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chip: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
