import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

export default function PushTestScreen() {
  const [token, setToken] = useState('Tap the button to get an FCM token');

  async function handleGetToken() {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }

    try {
      const fcmToken = await messaging().getToken();
      setToken(fcmToken);
    } catch (error: any) {
      setToken('Error, ' + (error.message || 'could not get token'));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>This is the same token your existing send push function already expects in the push_tokens table.</Text>
      <Text selectable style={styles.token}>{token}</Text>
      <TouchableOpacity style={styles.button} onPress={handleGetToken}>
        <Text style={styles.buttonText}>Get FCM Token</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F5F8FE' },
  label: { fontSize: 14, color: '#5A6472', marginBottom: 16, textAlign: 'center' },
  token: { fontSize: 12, color: '#1A2233', marginBottom: 24, textAlign: 'center' },
  button: { backgroundColor: '#1857D6', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
