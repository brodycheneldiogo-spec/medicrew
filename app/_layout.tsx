import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'react-native';
import * as Notifications from 'expo-notifications';
import { colors } from '../lib/theme';
import { registerPushNotifications } from '../lib/push';
import { supabase } from '../lib/supabase';

function NotificationObserver() {
  useEffect(() => {
    let mounted = true;
    const registerForCurrentUser = async () => { try { if (mounted) await registerPushNotifications(); } catch { /* push stays optional */ } };
    registerForCurrentUser();
    const authSubscription = supabase?.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') registerForCurrentUser(); });
    const initial = Notifications.getLastNotificationResponse();if (mounted && initial) routeNotification(initial.notification);
    const sub = Notifications.addNotificationResponseReceivedListener((response) => routeNotification(response.notification));
    return () => { mounted=false;authSubscription?.data.subscription.unsubscribe();sub.remove(); };
  }, []);
  function routeNotification(notification: Notifications.Notification) { const data=notification.request.content.data as Record<string,unknown>;const url=data?.url;if(typeof url==='string'&&url.startsWith('/'))router.push(url as never);else if(data?.mission_id)router.push({pathname:'/mission',params:{id:String(data.mission_id)}}); }
  return null;
}

const EXEMPT=new Set(['','auth','auth/callback','forgot-password','reset-password','verify-email','legal-consent','onboarding','professional/passport','professional/verification','company-verification','pending-review','terms','privacy','data-policy','admin','admin-preview']);
function VerificationAccessGuard(){const segments=useSegments();useEffect(()=>{let alive=true;const check=async()=>{const c=supabase;if(!c)return;const{data:{user}}=await c.auth.getUser();if(!user||!alive)return;const path=segments.join('/');if(EXEMPT.has(path))return;const{data,error}=await c.rpc('my_account_access_state');if(error||!alive)return;const state=(data||{}) as {role?:string;status?:string;allowed?:boolean};if(state.role==='admin')return;if(state.allowed===false)router.replace('/pending-review')};void check();return()=>{alive=false}},[segments]);return null}

export default function RootLayout(){return <><StatusBar barStyle="dark-content" backgroundColor={colors.paper}/><NotificationObserver/><VerificationAccessGuard/><Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.paper},animation:'slide_from_right',gestureEnabled:true,fullScreenGestureEnabled:true}}/></>}
