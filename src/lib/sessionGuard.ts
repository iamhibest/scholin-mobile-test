import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { isOnline } from './network';

// When the phone is offline, refreshing the sign in fails, and the app used to read that as "signed out" and open the Sign in page.
// This keeps the last good session, so being offline never signs anyone out. Signing out on purpose still clears it.
const KEY = 'scholin.lastSession';

export function startSessionGuard() {
  const auth: any = supabase.auth;
  if (auth.__scholinGuard) {
    return;
  }
  auth.__scholinGuard = true;
  const original = auth.getSession.bind(auth);
  // Remember the current session right away, so even the very first offline start has something to fall back on.
  original().then((r: any) => {
    if (r && r.data && r.data.session) {
      AsyncStorage.setItem(KEY, JSON.stringify(r.data.session)).catch(() => {});
    }
  }).catch(() => {});

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      AsyncStorage.removeItem(KEY).catch(() => {});
    } else if (session) {
      AsyncStorage.setItem(KEY, JSON.stringify(session)).catch(() => {});
    }
  });

  auth.getSession = async () => {
    const result = await original();
    if (result && result.data && result.data.session) {
      return result;
    }
    const message = result && result.error ? String(result.error.message || result.error.name || '') : '';
    if (!isOnline() || /network|fetch|retry|timeout/i.test(message)) {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          return { data: { session: JSON.parse(raw) }, error: null };
        }
      } catch {}
    }
    return result;
  };
}
