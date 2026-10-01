import AsyncStorage from '@react-native-async-storage/async-storage';

const WELCOME_KEY = 'scholin_welcome_seen';
const DESTINATION_KEY = 'scholin_last_destination';

export async function hasSeenWelcome() {
  try {
    return (await AsyncStorage.getItem(WELCOME_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function markWelcomeSeen() {
  try {
    await AsyncStorage.setItem(WELCOME_KEY, 'true');
  } catch {}
}

export async function getLastDestination() {
  try {
    return await AsyncStorage.getItem(DESTINATION_KEY);
  } catch {
    return null;
  }
}

export async function saveLastDestination(name: string) {
  try {
    await AsyncStorage.setItem(DESTINATION_KEY, name);
  } catch {}
}
