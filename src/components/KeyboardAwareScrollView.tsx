import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { findNodeHandle, NativeScrollEvent, NativeSyntheticEvent, ScrollView, ScrollViewProps, StyleSheet, TextInput } from 'react-native';
import { KEYBOARD_MARGIN, keyboardTop, onKeyboardHide, onKeyboardShow } from '../lib/keyboardMetrics';

// A ScrollView that scrolls the field you are typing in up above the keyboard.
// Used in place of ScrollView everywhere, so no screen, form or popup is covered by the keyboard.
const KeyboardAwareScrollView = forwardRef<ScrollView, ScrollViewProps>(function KeyboardAwareScrollView(props, ref) {
  const inner = useRef<ScrollView>(null);
  const offset = useRef(0);
  const viewH = useRef(0);
  const kbH = useRef(0);
  const lastFocused = useRef<any>(null);
  const [open, setOpen] = useState(false);
  useImperativeHandle(ref, () => inner.current as ScrollView);

  const reveal = useCallback(() => {
    const sv: any = inner.current;
    const input: any = TextInput.State.currentlyFocusedInput ? TextInput.State.currentlyFocusedInput() : null;
    if (!sv || !input || kbH.current <= 0) {
      return;
    }
    const content = sv.getInnerViewRef ? sv.getInnerViewRef() : null;
    const contentNode = content ? findNodeHandle(content) : null;
    if (!contentNode || !input.measureLayout) {
      return;
    }
    // measureLayout only succeeds when the field really lives inside this scroll view.
    input.measureLayout(
      contentNode,
      (_x: number, y: number, _w: number, h: number) => {
        sv.measureInWindow((_sx: number, sy: number, _sw: number, sh: number) => {
          const hiddenByKeyboard = Math.max(0, sy + sh - keyboardTop(kbH.current));
          const visible = (viewH.current || sh) - hiddenByKeyboard - KEYBOARD_MARGIN;
          const bottom = y + h;
          if (bottom > offset.current + visible) {
            sv.scrollTo({ y: Math.max(0, bottom - visible), animated: true });
          } else if (y < offset.current + 8) {
            sv.scrollTo({ y: Math.max(0, y - 16), animated: true });
          }
        });
      },
      () => {},
    );
  }, []);

  useEffect(() => {
    if (props.horizontal) {
      return;
    }
    const show = onKeyboardShow(h => {
      kbH.current = h;
      setOpen(true);
      // The layout settles a moment after the keyboard appears, so check a few times.
      [30, 160, 380].forEach(ms => setTimeout(reveal, ms));
    });
    const hide = onKeyboardHide(() => {
      kbH.current = 0;
      lastFocused.current = null;
      setOpen(false);
    });
    // Moving from one field to the next while the keyboard stays open fires no keyboard event, so watch for it.
    const timer = setInterval(() => {
      if (kbH.current <= 0) {
        return;
      }
      const f = TextInput.State.currentlyFocusedInput ? TextInput.State.currentlyFocusedInput() : null;
      if (f && f !== lastFocused.current) {
        lastFocused.current = f;
        reveal();
      }
    }, 250);
    return () => {
      show.remove();
      hide.remove();
      clearInterval(timer);
    };
  }, [props.horizontal, reveal]);

  const flat: any = StyleSheet.flatten(props.contentContainerStyle) || {};
  const basePad = flat.paddingBottom !== undefined ? flat.paddingBottom : flat.padding !== undefined ? flat.padding : flat.paddingVertical !== undefined ? flat.paddingVertical : 0;
  const contentStyle = open && !props.horizontal ? [props.contentContainerStyle, { paddingBottom: Number(basePad) + KEYBOARD_MARGIN + 24 }] : props.contentContainerStyle;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      {...props}
      ref={inner}
      contentContainerStyle={contentStyle}
      scrollEventThrottle={props.scrollEventThrottle || 16}
      onLayout={e => {
        viewH.current = e.nativeEvent.layout.height;
        if (props.onLayout) {
          props.onLayout(e);
        }
      }}
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        offset.current = e.nativeEvent.contentOffset.y;
        if (props.onScroll) {
          props.onScroll(e);
        }
      }}
    />
  );
});

export default KeyboardAwareScrollView;
