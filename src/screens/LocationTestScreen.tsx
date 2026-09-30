import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, PermissionsAndroid } from 'react-native';
import Geolocation from 'react-native-geolocation-service';

async function requestLocationPermission() {
  if (Platform.OS !== 'android') {
    return true;
  }
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export default function LocationTestScreen() {
  const [result, setResult] = useState('Tap the button to get your position');

  async function handleGetLocation() {
    const ok = await requestLocationPermission();
    if (!ok) {
      setResult('Location permission was not granted');
      return;
    }

    setResult('Getting location...');

    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setResult(
          'Latitude ' + latitude.toFixed(6) +
          ', Longitude ' + longitude.toFixed(6) +
          ', Accuracy ' + accuracy.toFixed(0) + ' meters'
        );
      },
      (error) => {
        setResult('Error ' + error.code + ', ' + error.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.result}>{result}</Text>
      <TouchableOpacity style={styles.button} onPress={handleGetLocation}>
        <Text style={styles.buttonText}>Get Current Location</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F5F8FE' },
  result: { fontSize: 15, color: '#1A2233', marginBottom: 24, textAlign: 'center' },
  button: { backgroundColor: '#1857D6', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
