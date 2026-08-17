import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { colors } from '../lib/theme';

export default function RootLayout() {
  return <><StatusBar barStyle="dark-content" backgroundColor={colors.paper}/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.paper}}}/></>;
}