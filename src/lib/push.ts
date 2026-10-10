import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FirebaseMessaging from '@react-native-firebase/messaging';
import { supabase } from './supabase';
import { logger } from './logger';
import { navigationRef } from './deeplink';

// Push notifications: saves this phone's token against the signed in person so the server can reach them
// (even when the app is closed), shows a banner when a message arrives while the app is open,
// and opens the right page when a notification is tapped.

const TOKEN_KEY = 'scholin.pushToken';
type Incoming = { title: string; body: string; data: Record<string, any> };
type Listener = (m: Incoming) => void;

const listeners: Listener[] = [];
export function onForegroundNotification(cb: Listener) {
  listeners.push(cb);
  return () => {
    const i = listeners.indexOf(cb);
    if (i >= 0) {
      listeners.splice(i, 1);
    }
  };
}

// Works with both styles of the Firebase messaging library.
function api() {
  const fm: any = FirebaseMessaging;
  if (typeof fm.getMessaging === 'function' && typeof fm.getToken === 'function') {
    const m = fm.getMessaging();
    return {
      getToken: () => fm.getToken(m),
      onTokenRefresh: (cb: (t: string) => void) => fm.onTokenRefresh(m, cb),
      onMessage: (cb: (msg: any) => void) => fm.onMessage(m, cb),
      onOpened: (cb: (msg: any) => void) => fm.onNotificationOpenedApp(m, cb),
      initial: () => fm.getInitialNotification(m),
      background: (cb: (msg: any) => Promise<void>) => fm.setBackgroundMessageHandler(m, cb),
    };
  }
  const inst = fm.default();
  return {
    getToken: () => inst.getToken(),
    onTokenRefresh: (cb: (t: string) => void) => inst.onTokenRefresh(cb),
    onMessage: (cb: (msg: any) => void) => inst.onMessage(cb),
    onOpened: (cb: (msg: any) => void) => inst.onNotificationOpenedApp(cb),
    initial: () => inst.getInitialNotification(),
    background: (cb: (msg: any) => Promise<void>) => inst.setBackgroundMessageHandler(cb),
  };
}

export async function notificationsAllowed(): Promise<boolean> {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    try {
      return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    } catch {
      return false;
    }
  }
  return true;
}

// Android 13 and above must ask before any notification can show.
export async function turnOnNotifications(): Promise<boolean> {
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) {
    try {
      const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (r !== PermissionsAndroid.RESULTS.GRANTED) {
        return false;
      }
    } catch {
      return false;
    }
  }
  await registerDevice();
  return true;
}

let lastSaved = '';

async function saveToken(token: string, userId: string) {
  const key = userId + ':' + token;
  if (key === lastSaved) {
    return;
  }
  const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
  if (error) {
    logger.error('Could not save notification token: ' + error.message);
    return;
  }
  lastSaved = key;
  await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
}

export async function getFcmToken(): Promise<string> {
  return api().getToken();
}

// Saves this phone's token and says exactly what went wrong if it could not.
export async function registerDeviceDetailed(): Promise<{ ok: boolean; message: string; token: string }> {
  try {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      return { ok: false, message: 'You are not signed in.', token: '' };
    }
    if (!(await notificationsAllowed())) {
      return { ok: false, message: 'Notifications are switched off for this app on your phone.', token: '' };
    }
    const token = await api().getToken();
    if (!token) {
      return { ok: false, message: 'Firebase did not give this phone a token.', token: '' };
    }
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    if (error) {
      logger.error('Could not save notification token: ' + error.message);
      return { ok: false, message: error.message, token };
    }
    lastSaved = user.id + ':' + token;
    await AsyncStorage.setItem(TOKEN_KEY, token).catch(() => {});
    return { ok: true, message: 'Saved.', token };
  } catch (e: any) {
    const m = e && e.message ? e.message : String(e);
    logger.error('Notification setup failed: ' + m);
    return { ok: false, message: m, token: '' };
  }
}

export async function registerDevice() {
  await registerDeviceDetailed();
}

async function unregisterDevice() {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    lastSaved = '';
    if (token) {
      await supabase.rpc('unregister_push_token', { p_token: token });
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

function readMessage(msg: any): Incoming {
  const n = (msg && msg.notification) || {};
  const d = (msg && msg.data) || {};
  return { title: String(n.title || d.title || 'Scholin'), body: String(n.body || d.message || d.body || ''), data: d };
}

export function openFromNotification(data: Record<string, any>) {
  const go = (tries: number) => {
    if (!navigationRef.isReady()) {
      if (tries > 0) {
        setTimeout(() => go(tries - 1), 500);
      }
      return;
    }
    const id = data.announcement_id || data.announcementId;
    if (id) {
      navigationRef.navigate('AnnouncementDetail', { id: String(id) });
      return;
    }
    const category = String(data.category || '').toLowerCase();
    if (category.indexOf('announcement') >= 0 || category === 'broadcast') {
      navigationRef.navigate('Announcements');
    }
  };
  go(10);
}

let started = false;

export function startPush() {
  if (started) {
    return;
  }
  started = true;
  try {
    const fm = api();
    // A handler must exist for messages that arrive while the app is closed.
    fm.background(async () => {});
    fm.onMessage((msg: any) => listeners.forEach(l => l(readMessage(msg))));
    fm.onOpened((msg: any) => openFromNotification(readMessage(msg).data));
    fm.initial().then((msg: any) => {
      if (msg) {
        openFromNotification(readMessage(msg).data);
      }
    }).catch(() => {});
    fm.onTokenRefresh(() => registerDevice());
  } catch (e: any) {
    logger.error('Notifications could not start: ' + (e && e.message ? e.message : e));
  }

  // Ask for permission and save the token when someone signs in (or the app opens already signed in).
  supabase.auth.onAuthStateChange((event, session) => {
    if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
      setTimeout(() => turnOnNotifications().catch(() => {}), 800);
    }
  });
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      turnOnNotifications().catch(() => {});
    }
  }).catch(() => {});

  // Take this phone off the person's account before they sign out, so it stops getting their notifications.
  const auth: any = supabase.auth;
  if (!auth.__scholinPushSignOut) {
    auth.__scholinPushSignOut = true;
    const original = auth.signOut.bind(auth);
    auth.signOut = async (...args: any[]) => {
      await unregisterDevice();
      return original(...args);
    };
  }
}
