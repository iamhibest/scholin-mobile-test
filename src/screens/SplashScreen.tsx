import React, { useEffect, useRef } from 'react';
import { Animated, Image, StatusBar, StyleSheet, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { hasSeenWelcome } from '../lib/storage';
import { resolveDestination } from '../lib/session';
import { logger } from '../lib/logger';
import { consumeRecovery } from '../lib/deeplink';
import BrandEmblem from '../components/BrandEmblem';

const EMBLEM_HEIGHT = 124;
const EMBLEM_WIDTH = Math.round((EMBLEM_HEIGHT * 692) / 720);
const WORD_WIDTH = 190;
const WORD_HEIGHT = Math.round((WORD_WIDTH * 271) / 900);
const MIN_DISPLAY = 2200;

export default function SplashScreen({ navigation }: any) {
  const word = useRef(new Animated.Value(0)).current;
  const shift = (StatusBar.currentHeight || 0) / 2;

  useEffect(() => {
    Animated.timing(word, { toValue: 1, duration: 650, delay: 350, useNativeDriver: true }).start();

    let cancelled = false;
    const started = Date.now();

    async function decide() {
      let target = 'Welcome';
      let params: any;
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (user) {
          target = await resolveDestination(user.id);
        } else {
          target = (await hasSeenWelcome()) ? 'Login' : 'Welcome';
        }
      } catch (e: any) {
        logger.error('Startup check failed: ' + e.message);
        target = (await hasSeenWelcome()) ? 'Login' : 'Welcome';
      }
      const wait = Math.max(0, MIN_DISPLAY - (Date.now() - started));
      setTimeout(() => {
        if (!cancelled) {
          if (consumeRecovery()) {
            target = 'ResetPassword';
          }
          navigation.reset({ index: 0, routes: [{ name: target, params }] });
        }
      }, wait);
    }

    decide();
    return () => {
      cancelled = true;
    };
  }, [navigation, word]);

  return (
    <View style={styles.root}>
      <View style={{ transform: [{ translateY: -shift }], alignItems: 'center' }}>
        <BrandEmblem style={{ width: EMBLEM_WIDTH, height: EMBLEM_HEIGHT }} />
        <Animated.View style={[styles.word, { opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
          <Image source={require('../assets/images/wordmark.png')} style={{ width: WORD_WIDTH, height: WORD_HEIGHT }} resizeMode="contain" />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  word: { position: 'absolute', top: EMBLEM_HEIGHT + 18 },
});
