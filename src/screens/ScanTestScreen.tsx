import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';

export default function ScanTestScreen() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [lastCode, setLastCode] = useState('Point the camera at a QR code');
  const [info, setInfo] = useState('Starting camera...');

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'code-128', 'code-39'],
    onCodeScanned: (codes) => {
      const value = codes[0]?.value;
      setInfo('Scanner fired, codes found: ' + codes.length);
      if (value) {
        setLastCode(value);
      }
    },
  });

  if (!hasPermission) {
    return (
      <View style={styles.center}>
        <Text>Camera permission is needed for this test</Text>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.center}>
        <Text>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        codeScanner={codeScanner}
        onInitialized={() => setInfo('Camera ready, scanner listening')}
        onError={(e: any) => setInfo('Camera error: ' + (e?.message || String(e)))}
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>{lastCode}</Text>
        <Text style={styles.overlayText}>{info}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  overlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 14,
    borderRadius: 12,
  },
  overlayText: { color: '#FFFFFF', fontSize: 14, textAlign: 'center' },
});
