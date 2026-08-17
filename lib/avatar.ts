import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export async function chooseAndUploadAvatar(userId:string,currentPath?:string|null){
  if(!supabase) throw new Error('Supabase is not configured');
  const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
  if(!permission.granted){Alert.alert('Photo access required','Allow MediCrew to access your photos to choose a profile picture.');return null;}
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.85,exif:false});
  if(result.canceled||!result.assets?.[0]) return null;
  const asset=result.assets[0];
  const mime=asset.mimeType||'image/jpeg';
  if(!['image/jpeg','image/png','image/webp'].includes(mime)) throw new Error('Use a JPG, PNG or WEBP image.');
  if((asset.fileSize||0)>5*1024*1024) throw new Error('Profile photos must be smaller than 5 MB.');
  const ext=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
  const path=`${userId}/${Date.now()}.${ext}`;
  const body=await fetch(asset.uri).then(r=>r.arrayBuffer());
  const upload=await supabase.storage.from('avatars').upload(path,body,{contentType:mime,cacheControl:'3600',upsert:false});
  if(upload.error) throw upload.error;
  if(currentPath && currentPath.startsWith(`${userId}/`)) await supabase.storage.from('avatars').remove([currentPath]);
  const profile=await supabase.from('profiles').update({avatar_url:path}).eq('id',userId);
  if(profile.error){await supabase.storage.from('avatars').remove([path]);throw profile.error;}
  return path;
}

export function avatarUrl(path?:string|null){
  if(!path) return null;
  if(path.startsWith('http')) return path;
  if(!supabase) return null;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
