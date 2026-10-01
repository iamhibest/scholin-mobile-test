import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import ErrorBoundary from './src/components/ErrorBoundary';
import { logger } from './src/lib/logger';
import { navigationRef, startDeepLinks } from './src/lib/deeplink';
import { startQueueSync } from './src/lib/offlineQueue';
import './src/lib/supabase';

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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ErrorBoundary>
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
