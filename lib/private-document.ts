import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';
const types=['application/pdf','image/jpeg','image/png','image/webp'],maxBytes=10*1024*1024;
export async function pickAndUploadPrivateDocument(bucket:'professional-documents'|'company-documents',userId:string){
 if(!supabase)throw new Error('MediCrew is not configured');
 const result=await DocumentPicker.getDocumentAsync({type:types,copyToCacheDirectory:true,multiple:false});if(result.canceled)return null;
 const file=result.assets[0],mime=file.mimeType||'application/octet-stream';if(!types.includes(mime))throw new Error('Choose a PDF, JPG, PNG or WEBP file.');if(file.size!=null&&file.size>maxBytes)throw new Error('The file must be 10 MB or smaller.');
 const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)||'document',path=`${userId}/${Date.now()}-${safe}`,body=await (await fetch(file.uri)).arrayBuffer();
 const upload=await supabase.storage.from(bucket).upload(path,body,{contentType:mime,cacheControl:'3600',upsert:false});if(upload.error)throw upload.error;
 return{path,name:file.name,mime,size:file.size??body.byteLength};
}
