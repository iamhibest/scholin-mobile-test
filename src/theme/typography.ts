import { TextStyle } from 'react-native';

export const fonts = {
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  heading: 'Lora_600SemiBold',
  headingBold: 'Lora_700Bold',
};

export const text: Record<string, TextStyle> = {
  display: { fontFamily: fonts.headingBold, fontSize: 32, lineHeight: 40 },
  h1: { fontFamily: fonts.headingBold, fontSize: 26, lineHeight: 34 },
  h2: { fontFamily: fonts.heading, fontSize: 21, lineHeight: 28 },
  h3: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  button: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
};
