import React, { useState } from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { useBrand } from '../lib/brand';

// The Scholin emblem. Shows the logo the super admin uploaded, or the built in one if there is none or it cannot load.
export default function BrandEmblem({ style }: { style?: StyleProp<ImageStyle> }) {
  const brand = useBrand();
  const [failed, setFailed] = useState(false);
  const source = brand && brand.logo && !failed ? { uri: brand.logo } : require('../assets/images/emblem.png');
  return <Image source={source} style={style} resizeMode="contain" onError={() => setFailed(true)} />;
}
