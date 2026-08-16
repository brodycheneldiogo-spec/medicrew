import { Stack } from 'expo-router';
import { Platform, StatusBar } from 'react-native';

export default function RootLayout() {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8F6" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F7F8F6' } }} />
    </>
  );
}
