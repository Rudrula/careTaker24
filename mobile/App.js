import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { DataProvider } from './src/context/DataContext';
import RootNavigator from './src/navigation/RootNavigator';
import NotificationBridge from './src/components/NotificationBridge';
import { configureNotifications } from './src/services/notificationService';

export default function App() {
  // Registers the Android alarm channel and the Take/Skip/Postpone
  // notification action buttons once, at app start.
  useEffect(() => { configureNotifications().catch(() => {}); }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <DataProvider>
              <StatusBar style="auto" />
              {/* Side-effect only — wires notification button taps to app
                  state. Must be inside DataProvider to use useData(). */}
              <NotificationBridge />
              <RootNavigator />
            </DataProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
