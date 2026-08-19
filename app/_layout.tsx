import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'react-native';
import * as Notifications from 'expo-notifications';
import { colors } from '../lib/theme';
import { registerPushNotifications } from '../lib/push';
import { supabase } from '../lib/supabase';

function NotificationObserver() {
  useEffect(() => {
    let mounted = true;

    const registerForCurrentUser = async () => {
      try {
        if (mounted) await registerPushNotifications();
      } catch {
        // Push is optional; authentication and navigation must not be blocked by it.
      }
    };

    registerForCurrentUser();
    const authSubscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') registerForCurrentUser();
    });

    const initial = Notifications.getLastNotificationResponse();
    if (mounted && initial) routeNotification(initial.notification);

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      routeNotification(response.notification);
    });

    return () => {
      mounted = false;
      authSubscription?.data.subscription.unsubscribe();
      sub.remove();
    };
  }, []);

  function routeNotification(notification: Notifications.Notification) {
    const data = notification.request.content.data as Record<string, unknown>;
    const url = data?.url;
    if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
    else if (data?.mission_id) {
      router.push({ pathname: '/mission', params: { id: String(data.mission_id) } });
    }
  }

  return null;
}

export default function RootLayout() {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <NotificationObserver />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />
    </>
  );
}
