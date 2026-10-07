import NetInfo from '@react-native-community/netinfo';

// Connection state for the whole app. This file must load before the Supabase client is created,
// because it wraps fetch: while the phone is offline, requests fail at once and the "not connected" dialog can show.
let online = true;
let lastTouch = 0;
let lastDialog = 0;
const onlineListeners = new Set<(v: boolean) => void>();
const dialogListeners = new Set<() => void>();

function apply(state: any) {
  const now = !!state && state.isConnected !== false && state.isInternetReachable !== false;
  if (now !== online) {
    online = now;
    onlineListeners.forEach(l => l(now));
  }
}

export const isOnline = () => online;

export function onOnlineChange(listener: (v: boolean) => void) {
  onlineListeners.add(listener);
  return () => {
    onlineListeners.delete(listener);
  };
}

export function onOfflineDialog(listener: () => void) {
  dialogListeners.add(listener);
  return () => {
    dialogListeners.delete(listener);
  };
}

export function noteTouch() {
  lastTouch = Date.now();
}

// Only shows when the person just tapped something (not for background refreshes), and never more than once every few seconds.
export function showOfflineDialog() {
  const now = Date.now();
  if (now - lastTouch > 4000 || now - lastDialog < 6000) {
    return;
  }
  lastDialog = now;
  dialogListeners.forEach(l => l());
}

export async function recheck() {
  try {
    apply(await NetInfo.fetch());
  } catch {}
  return online;
}

const g: any = global;
if (!g.__scholinNetwork) {
  g.__scholinNetwork = true;
  NetInfo.addEventListener(apply);
  const original = g.fetch;
  g.fetch = async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input && input.url ? input.url : '';
    if (!/^https?:/i.test(url)) {
      return original(input, init);
    }
    if (!online) {
      showOfflineDialog();
      throw new TypeError('Network request failed');
    }
    try {
      return await original(input, init);
    } catch (e) {
      // A failed request might mean the connection just dropped. Check, and tell the person if so.
      recheck().then(ok => {
        if (!ok) {
          showOfflineDialog();
        }
      });
      throw e;
    }
  };
}
