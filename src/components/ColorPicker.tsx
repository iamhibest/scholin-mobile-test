import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors, fonts, radius, spacing, text } from '../theme';
import BottomSheet from './BottomSheet';
import Button from './Button';

type Props = { visible: boolean; title: string; value: string; onClose: () => void; onPick: (hex: string) => void };

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16) || 0, g: parseInt(h.slice(2, 4), 16) || 0, b: parseInt(h.slice(4, 6), 16) || 0 };
}

function rgbToHex(r: number, g: number, b: number) {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return ('#' + c(r) + c(g) + c(b)).toUpperCase();
}

function hexToHsv(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) {
      h = ((gn - bn) / d) % 6;
    } else if (max === gn) {
      h = (bn - rn) / d + 2;
    } else {
      h = (rn - gn) / d + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex(h: number, s: number, v: number) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

const PRESETS = ['#0F4A3A', '#0B2A5B', '#1A56DB', '#064C42', '#7A1F2B', '#C62828', '#C9A24A', '#F7C95A', '#E07B00', '#6D28D9', '#0E7490', '#111827', '#6B7280', '#FFFFFF', '#FBF9F3', '#F3F4F6'];

const SV_H = 190;
const HUE_H = 30;

function useDrag(onMove: (x: number, y: number) => void) {
  const handler = useRef(onMove);
  handler.current = onMove;
  return useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: e => handler.current(e.nativeEvent.locationX, e.nativeEvent.locationY),
      onPanResponderMove: e => handler.current(e.nativeEvent.locationX, e.nativeEvent.locationY),
    }),
  ).current;
}

export default function ColorPicker({ visible, title, value, onClose, onPick }: Props) {
  const [hsv, setHsv] = useState(hexToHsv(/^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#1A56DB'));
  const [hexText, setHexText] = useState(value);
  const [width, setWidth] = useState(300);
  const widthRef = useRef(300);
  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  useEffect(() => {
    if (visible) {
      const start = hexToHsv(/^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#1A56DB');
      setHsv(start);
      setHexText(/^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : '#1A56DB');
    }
  }, [visible, value]);

  const update = (h: number, s: number, v: number) => {
    setHsv({ h, s, v });
    setHexText(hsvToHex(h, s, v));
  };

  const svPan = useDrag((x, y) => {
    const s = Math.max(0, Math.min(1, x / widthRef.current));
    const v = 1 - Math.max(0, Math.min(1, y / SV_H));
    update(hsvRef.current.h, s, v);
  });
  const huePan = useDrag(x => {
    const h = Math.max(0, Math.min(359.9, (x / widthRef.current) * 360));
    update(h, hsvRef.current.s, hsvRef.current.v);
  });

  const current = hsvToHex(hsv.h, hsv.s, hsv.v);
  const hueColor = hsvToHex(hsv.h, 1, 1);

  const typed = (t: string) => {
    const v = t.startsWith('#') ? t.slice(0, 7) : '#' + t.slice(0, 6);
    setHexText(v.toUpperCase());
    if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
      setHsv(hexToHsv(v));
    }
  };

  const choose = (hex: string) => {
    setHsv(hexToHsv(hex));
    setHexText(hex);
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <View
        onLayout={e => {
          widthRef.current = e.nativeEvent.layout.width;
          setWidth(e.nativeEvent.layout.width);
        }}>
        <View style={[styles.sv, { width, height: SV_H }]} {...svPan.panHandlers}>
          <Svg width={width} height={SV_H} pointerEvents="none">
            <Defs>
              <LinearGradient id="sat" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#FFFFFF" />
                <Stop offset="1" stopColor={hueColor} />
              </LinearGradient>
              <LinearGradient id="val" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000000" stopOpacity="0" />
                <Stop offset="1" stopColor="#000000" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={width} height={SV_H} fill="url(#sat)" />
            <Rect x="0" y="0" width={width} height={SV_H} fill="url(#val)" />
          </Svg>
          <View pointerEvents="none" style={[styles.knob, { left: hsv.s * width - 12, top: (1 - hsv.v) * SV_H - 12 }]} />
        </View>

        <View style={[styles.hue, { width, height: HUE_H }]} {...huePan.panHandlers}>
          <Svg width={width} height={HUE_H} pointerEvents="none">
            <Defs>
              <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
                {['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'].map((c, i) => (
                  <Stop key={i} offset={String(i / 6)} stopColor={c} />
                ))}
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={width} height={HUE_H} rx="15" fill="url(#hue)" />
          </Svg>
          <View pointerEvents="none" style={[styles.hueKnob, { left: (hsv.h / 360) * width - 13 }]} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.preview, { backgroundColor: current }]} />
        <TextInput value={hexText} onChangeText={typed} autoCapitalize="characters" autoCorrect={false} style={styles.hex} />
      </View>

      <Text style={[text.caption, { color: colors.textMuted, marginBottom: 8 }]}>QUICK COLOURS</Text>
      <View style={styles.presets}>
        {PRESETS.map(p => (
          <Pressable key={p} onPress={() => choose(p)} style={[styles.preset, { backgroundColor: p }, current === p && { borderColor: colors.primary, borderWidth: 3 }]} />
        ))}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
        <Button title="Cancel" variant="soft" onPress={onClose} style={{ flex: 1 }} />
        <Button
          title="Use this colour"
          onPress={() => {
            onPick(current);
            onClose();
          }}
          style={{ flex: 1.4 }}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sv: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  knob: { position: 'absolute', width: 24, height: 24, borderRadius: 12, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, elevation: 4 },
  hue: { marginTop: spacing.md, borderRadius: 15, overflow: 'hidden' },
  hueKnob: { position: 'absolute', top: 2, width: 26, height: 26, borderRadius: 13, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: 'transparent', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, elevation: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginVertical: spacing.lg },
  preview: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  hex: { flex: 1, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, textAlign: 'center', fontFamily: fonts.semibold, fontSize: 18, color: colors.text, paddingVertical: 0, letterSpacing: 1 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  preset: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border },
});
