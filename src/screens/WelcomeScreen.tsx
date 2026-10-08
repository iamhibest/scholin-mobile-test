import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Icon, Screen } from '../components';
import { IconName } from '../components/Icon';
import { colors, radius, shadow, spacing, text } from '../theme';
import { env } from '../config/env';
import { markWelcomeSeen } from '../lib/storage';
import { useBrand } from '../lib/brand';
import BrandEmblem from '../components/BrandEmblem';

const features: { label: string; icon: IconName; tint: string; color: string }[] = [
  { label: 'Students', icon: 'users', tint: colors.primarySoft, color: colors.primary },
  { label: 'Classes', icon: 'book', tint: colors.purpleSoft, color: colors.purple },
  { label: 'Fees', icon: 'wallet', tint: colors.successSoft, color: colors.success },
  { label: 'Reports', icon: 'fileCheck', tint: colors.accentSoft, color: colors.accent },
];

export default function WelcomeScreen({ navigation }: any) {
  const brand = useBrand();
  async function go(target: string) {
    await markWelcomeSeen();
    navigation.reset({ index: 1, routes: [{ name: 'Login' }, { name: target }] });
  }

  return (
    <Screen scroll background={colors.surface}>
      <View style={styles.top}>
        {brand && brand.logo ? (
          <View style={styles.custom}>
            <BrandEmblem style={styles.customEmblem} />
            <Image source={require('../assets/images/wordmark.png')} style={styles.customWord} resizeMode="contain" />
          </View>
        ) : (
          <Image source={require('../assets/images/logoHorizontal.png')} style={styles.logo} resizeMode="contain" />
        )}
        <Text style={[text.body, styles.tagline]}>Smarter Schools. Brighter Futures.</Text>
        <Text style={[text.display, styles.headline]}>Everything your school needs, in one place.</Text>
      </View>

      <View style={[styles.heroWrap, shadow.raised]}>
        <Image source={require('../assets/images/welcomeHero.jpg')} style={styles.hero} resizeMode="cover" />
      </View>

      <View style={styles.features}>
        {features.map(f => (
          <View key={f.label} style={styles.feature}>
            <View style={[styles.chip, { backgroundColor: f.tint }]}>
              <Icon name={f.icon} size={24} color={f.color} />
            </View>
            <Text style={[text.caption, styles.featureLabel]}>{f.label}</Text>
          </View>
        ))}
      </View>

      <Button title="Get started" icon="arrowRight" onPress={() => go('Register')} />

      <View style={styles.signin}>
        <Text style={[text.body, { color: colors.textMuted }]}>Already have an account? </Text>
        <Pressable onPress={async () => { await markWelcomeSeen(); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); }} hitSlop={10}>
          <Text style={[text.bodyStrong, { color: colors.primary }]}>Sign in</Text>
        </Pressable>
      </View>

      <Pressable onLongPress={() => navigation.navigate('Developer')} delayLongPress={900}>
        <Text style={[text.caption, styles.version]}>Version {env.appVersion}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', marginTop: spacing.sm },
  logo: { width: 230, height: 70 },
  custom: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 70 },
  customEmblem: { width: 64, height: 66 },
  customWord: { width: 150, height: 45 },
  tagline: { color: colors.textMuted, marginTop: spacing.xs },
  headline: { color: colors.text, textAlign: 'center', marginTop: spacing.xl, fontSize: 28, lineHeight: 36 },
  heroWrap: { marginTop: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.surface },
  hero: { width: '100%', height: 280, borderRadius: radius.xl },
  features: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.xl },
  feature: { alignItems: 'center', flex: 1 },
  chip: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { color: colors.text, marginTop: spacing.sm },
  signin: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  version: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
});
