import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme';
import Icon, { IconName } from './Icon';
import PressableScale from './PressableScale';

type Props = { title: string; onPress: () => void; icon?: IconName; loading?: boolean; disabled?: boolean };

// Primary call to action with a soft light that sweeps across now and then.
export default function ShineButton({ title, onPress, icon, loading, disabled }: Props) {
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1800),
        Animated.timing(sweep, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  const x = sweep.interpolate({ inputRange: [0, 1], outputRange: [-120, 420] });

  return (
    <PressableScale onPress={disabled || loading ? undefined : onPress} to={0.98} style={[styles.btn, disabled && { opacity: 0.5 }]}>
      <View style={styles.row}>
        {loading ? <ActivityIndicator color="#FFFFFF" /> : icon ? <Icon name={icon} size={20} color="#FFFFFF" /> : null}
        <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{title}</Text>
      </View>
      <Animated.View pointerEvents="none" style={[styles.shine, { transform: [{ translateX: x }, { skewX: '-20deg' }] }]} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: { minHeight: 54, paddingHorizontal: 18, borderRadius: radius.lg, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { color: '#FFFFFF', fontSize: 16, fontFamily: fonts.bold },
  shine: { position: 'absolute', top: 0, bottom: 0, width: 60, backgroundColor: 'rgba(255,255,255,0.22)' },
});
