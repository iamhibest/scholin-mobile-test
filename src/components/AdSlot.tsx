import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { AdsModule } from '../lib/adsNative';
import { AdConfig, loadAdConfig } from '../lib/ads';

let started = false;

// One quiet sponsored banner. It renders nothing at all when ads are off,
// the ad library is not in the build, or the ad fails to load, so the list never
// shows an empty gap.
export default function AdSlot() {
  const [cfg, setCfg] = useState<AdConfig | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!AdsModule) {
      return;
    }
    loadAdConfig().then(setCfg);
  }, []);

  useEffect(() => {
    if (!AdsModule || !cfg || !cfg.enabled || started) {
      return;
    }
    started = true;
    try {
      AdsModule.default().initialize();
    } catch {}
  }, [cfg]);

  if (!AdsModule || !cfg || !cfg.enabled || failed) {
    return null;
  }
  const unit = cfg.useTestAds ? AdsModule.TestIds.BANNER : cfg.bannerUnitId;
  if (!unit) {
    return null;
  }
  const { BannerAd, BannerAdSize } = AdsModule;

  return (
    <Animated.View style={[styles.wrap, { opacity: fade, height: ready ? undefined : 0, marginBottom: ready ? spacing.md : 0 }]}>
      <Text style={styles.tag}>Sponsored</Text>
      <View style={styles.box}>
        <BannerAd
          unitId={unit}
          size={BannerAdSize.LARGE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={() => {
            setReady(true);
            Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start();
          }}
          onAdFailedToLoad={() => setFailed(true)}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingVertical: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: '#EEF1F6', overflow: 'hidden' },
  tag: { alignSelf: 'flex-start', marginLeft: spacing.lg, marginBottom: 6, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: colors.textMuted, fontFamily: fonts.semibold },
  box: { alignItems: 'center', justifyContent: 'center' },
});
