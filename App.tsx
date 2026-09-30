import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import SplashOverlay from './src/components/SplashOverlay';
import ErrorBoundary from './src/components/ErrorBoundary';
import { logger } from './src/lib/logger';
import './src/lib/supabase';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const hideSplash = useCallback(() => setShowSplash(false), []);

  useEffect(() => {
    const globalScope: any = global;
    const previous = globalScope.ErrorUtils?.getGlobalHandler?.();
    globalScope.ErrorUtils?.setGlobalHandler?.((error: Error, isFatal?: boolean) => {
      logger.error((isFatal ? 'Fatal: ' : '') + error.message);
      previous?.(error, isFatal);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <ErrorBoundary>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </ErrorBoundary>
      {showSplash ? <SplashOverlay onDone={hideSplash} /> : null}
    </SafeAreaProvider>
  );
}
