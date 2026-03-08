import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';

async function checkForUpdate() {
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // Non-fatal — continue with current bundle
  }
}

export default function App() {
  useEffect(() => {
    if (!__DEV__) checkForUpdate();

    // Handle notification taps while app is running or backgrounded
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      console.log('[App] Notification tapped:', data);

      if (data?.screen === 'Objects' && data?.geofenceId && navigationRef.isReady()) {
        console.log('[App] Navigating to Objects screen with geofenceId:', data.geofenceId);
        navigationRef.navigate('Objects', { geofenceId: data.geofenceId });
      }
    });

    // Handle cold-start via notification tap
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      const data = response.notification.request.content.data as any;
      console.log('[App] Cold start with notification:', data);

      if (data?.screen === 'Objects' && data?.geofenceId && navigationRef.isReady()) {
        console.log('[App] Navigating to Objects screen with geofenceId:', data.geofenceId);
        navigationRef.navigate('Objects', { geofenceId: data.geofenceId });
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <AppNavigator />
    </AuthProvider>
  );
}
