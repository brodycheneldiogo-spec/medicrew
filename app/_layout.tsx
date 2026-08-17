import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'react-native';
import * as Notifications from 'expo-notifications';
import { colors } from '../lib/theme';
import { registerPushNotifications } from '../lib/push';

function NotificationObserver(){
 useEffect(()=>{
  registerPushNotifications().catch(()=>{});
  const initial=Notifications.getLastNotificationResponse();
  if(initial) routeNotification(initial.notification);
  const sub=Notifications.addNotificationResponseReceivedListener(response=>routeNotification(response.notification));
  return()=>sub.remove();
 },[]);
 function routeNotification(notification:Notifications.Notification){const data=notification.request.content.data as any;const url=data?.url;if(typeof url==='string')router.push(url as any);else if(data?.mission_id)router.push({pathname:'/mission',params:{id:String(data.mission_id)}})}
 return null;
}
export default function RootLayout(){
 return <><StatusBar barStyle="dark-content" backgroundColor={colors.paper}/><NotificationObserver/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.paper}}}/></>;
}
