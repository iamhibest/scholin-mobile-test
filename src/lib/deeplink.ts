import { Linking } from 'react-native';
import { createNavigationContainerRef } from '@react-navigation/native';
import { supabase } from './supabase';
import { logger } from './logger';

export const navigationRef = createNavigationContainerRef<any>();

let pendingRecovery = false;

export function consumeRecovery() {
  const value = pendingRecovery;
  pendingRecovery = false;
  return value;
}

function readParams(url: string) {
  const out: Record<string, string> = {};
  const cut = url.indexOf('#') >= 0 ? url.split('#')[1] : url.split('?')[1] || '';
  cut.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) {
      out[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  });
  return out;
}

async function handleUrl(url: string | null) {
  if (!url || url.indexOf('reset-password') < 0) {
    return;
  }
  const params = readParams(url);
  pendingRecovery = true;
  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (error) {
      logger.error('Reset link failed: ' + error.message);
    }
  }
  const current = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : 'Splash';
  if (current && current !== 'Splash') {
    pendingRecovery = false;
    navigationRef.reset({ index: 0, routes: [{ name: 'ResetPassword' }] });
  }
}

export function startDeepLinks() {
  Linking.getInitialURL().then(handleUrl);
  const sub = Linking.addEventListener('url', e => handleUrl(e.url));
  return () => sub.remove();
}
