import React from 'react';
import { Linking, StyleProp, Text, TextStyle } from 'react-native';
import { colors } from '../theme';

const URL = /((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]])/gi;

function open(raw: string) {
  const url = /^https?:\/\//i.test(raw) ? raw : 'https://' + raw;
  Linking.openURL(url).catch(() => {});
}

// Plain text where web addresses can be tapped. Text stays selectable for copying.
export default function LinkedText({ value, style }: { value: string; style?: StyleProp<TextStyle> }) {
  const parts = String(value || '').split(URL);
  return (
    <Text selectable style={style}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <Text key={i} style={{ color: colors.primary, textDecorationLine: 'underline' }} onPress={() => open(p)}>
            {p}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}
