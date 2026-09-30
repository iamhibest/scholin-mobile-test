import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import ScanTestScreen from './src/screens/ScanTestScreen';
import LocationTestScreen from './src/screens/LocationTestScreen';
import PushTestScreen from './src/screens/PushTestScreen';
import PdfTestScreen from './src/screens/PdfTestScreen';

const Stack = createNativeStackNavigator();

function HomeScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Phase 0 Test Kit</Text>
      <Text style={styles.subtitle}>Tap each one and confirm it works on your device</Text>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Scan')}>
        <Text style={styles.buttonText}>Test QR Scanner</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Location')}>
        <Text style={styles.buttonText}>Test Location</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Push')}>
        <Text style={styles.buttonText}>Test Push Token</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('Pdf')}>
        <Text style={styles.buttonText}>Test PDF Generation</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Scholin Phase 0' }} />
        <Stack.Screen name="Scan" component={ScanTestScreen} />
        <Stack.Screen name="Location" component={LocationTestScreen} />
        <Stack.Screen name="Push" component={PushTestScreen} />
        <Stack.Screen name="Pdf" component={PdfTestScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F5F8FE' },
  title: { fontSize: 22, fontWeight: '700', color: '#12409E', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#5A6472', marginBottom: 28 },
  button: {
    backgroundColor: '#1857D6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
