import React, { useEffect, useRef, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { KEYBOARD_MARGIN, keyboardTop, onKeyboardHide, onKeyboardShow } from '../lib/keyboardMetrics';

// Lifts everything inside it above the keyboard. It measures how much of itself the keyboard
// actually covers, so it does nothing extra on phones where Android already resizes the screen.
export default function KeyboardSafeView({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<View>(null);
  const [lift, setLift] = useState(0);

  useEffect(() => {
    const show = onKeyboardShow(h => {
      const measure = () => {
        if (!ref.current) {
          return;
        }
        ref.current.measureInWindow((_x, y, _w, height) => {
          const covered = y + height - keyboardTop(h);
          setLift(covered > 2 ? Math.round(covered + KEYBOARD_MARGIN) : 0);
        });
      };
      measure();
      setTimeout(measure, 180);
    });
    const hide = onKeyboardHide(() => setLift(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View ref={ref} collapsable={false} style={[{ flex: 1 }, style, lift > 0 ? { paddingBottom: lift } : null]}>
      {children}
    </View>
  );
}
