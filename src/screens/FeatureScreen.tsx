import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Icon, Screen } from '../components';
import { colors, spacing, text } from '../theme';

export default function FeatureScreen({ navigation, route }: any) {
  const title = route.params?.title || 'Coming soon';
  return (
    <Screen>
      <View style={styles.center}>
        <View style={styles.circle}>
          <Icon name="layers" size={34} color={colors.primary} />
        </View>
        <Text style={[text.h1, styles.title]}>{title}</Text>
        <Text style={[text.body, styles.body]}>This section is being rebuilt for the app and arrives in an upcoming phase. Everything in it will work just like the web version, with a cleaner design.</Text>
        <Button title="Go back" variant="soft" onPress={() => navigation.goBack()} style={styles.btn} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circle: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, marginTop: spacing.xl, textAlign: 'center' },
  body: { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  btn: { alignSelf: 'stretch', marginTop: spacing.xl },
});
