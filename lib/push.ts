import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';

Notifications.setNotificationHandler({handleNotification:async()=>({shouldPlaySound:true,shouldSetBadge:true,shouldShowBanner:true,shouldShowList:true})});
export async function registerPushNotifications(){if(!supabase||Platform.OS==='web')return null;const{data:{user}}=await supabase.auth.getUser();if(!user)return null;if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('missions',{name:'Mission updates',importance:Notifications.AndroidImportance.HIGH,vibrationPattern:[0,250,250,250],lightColor:'#18B889'});const permissions=await Notifications.getPermissionsAsync();let status=permissions.status;if(status!=='granted')status=(await Notifications.requestPermissionsAsync()).status;if(status!=='granted')return null;const projectId=process.env.EXPO_PUBLIC_EAS_PROJECT_ID||Constants.expoConfig?.extra?.eas?.projectId||Constants.easConfig?.projectId;if(!projectId)return null;const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;await supabase.from('push_tokens').upsert({profile_id:user.id,expo_push_token:token,platform:Platform.OS,last_seen_at:new Date().toISOString()},{onConflict:'expo_push_token'});return token}
