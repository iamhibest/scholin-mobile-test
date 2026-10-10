import { Dimensions, EmitterSubscription, Keyboard, Platform } from 'react-native';

export const KEYBOARD_SHOW = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
export const KEYBOARD_HIDE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

export function onKeyboardShow(cb: (height: number) => void): EmitterSubscription {
  return Keyboard.addListener(KEYBOARD_SHOW, e => cb(e.endCoordinates.height));
}

export function onKeyboardHide(cb: () => void): EmitterSubscription {
  return Keyboard.addListener(KEYBOARD_HIDE, () => cb());
}

// Where the top edge of the keyboard sits, in the same coordinate space as measureInWindow.
export function keyboardTop(keyboardHeight: number) {
  return Dimensions.get('screen').height - keyboardHeight;
}

// A little room so a field is never flush against the keyboard, and so small differences
// between devices (status bar, gesture bar) can never leave a field half hidden.
export const KEYBOARD_MARGIN = 28;
