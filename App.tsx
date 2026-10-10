import './src/lib/network';
import React, { useEffect } from 'react';
import { StatusBar, Text, TextInput } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineLayer from './src/components/OfflineLayer';
import { startSessionGuard } from './src/lib/sessionGuard';

// Must run before the first screen (the splash) asks whether someone is signed in.
startSessionGuard();
import { logger } from './src/lib/logger';
import { navigationRef, startDeepLinks } from './src/lib/deeplink';
import { startQueueSync } from './src/lib/offlineQueue';
import { startPush } from './src/lib/push';
import PushBanner from './src/components/PushBanner';
import './src/lib/supabase';

// Very large phone font settings used to push text out of buttons and fields.
// Text still follows the phone setting, but only up to a sensible limit.
const FONT_LIMIT = 1.15;
[Text, TextInput].forEach((component: any) => {
  try {
    const original = component && component.render;
    if (typeof original === 'function' && !component.__scholinPatched) {
      component.render = function (props: any, ref: any) {
        return original.call(this, { maxFontSizeMultiplier: FONT_LIMIT, ...props }, ref);
      };
      component.__scholinPatched = true;
    }
  } catch {}
});

export default function App() {
  useEffect(() => {
    const globalScope: any = global;
    const previous = globalScope.ErrorUtils?.getGlobalHandler?.();
    globalScope.ErrorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
      logger.error((isFatal ? 'Fatal: ' : '') + error.message);
      previous?.(error, isFatal);
    });
  }, []);

  useEffect(() => startDeepLinks(), []);

  useEffect(() => startQueueSync(), []);

  useEffect(() => startPush(), []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ErrorBoundary>
        <OfflineLayer>
          <NavigationContainer ref={navigationRef}>
            <RootNavigator />
          </NavigationContainer>
          <PushBanner />
        </OfflineLayer>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
