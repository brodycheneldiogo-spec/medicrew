import { useState } from 'react';
import { ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors,radii } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { usePreferences } from '../lib/preferences-context';
import { localize } from '../lib/i18n';

const ALLOWED_TYPES=['application/pdf','image/jpeg','image/png','image/webp'];
const MAX_BYTES=10*1024*1024;

export default function CompanyVerification(){
 const prefs=usePreferences();const L=(en:string,fr:string,es:string)=>localize(prefs.language,en,fr,es);
 const[saving,setSaving]=useState(false),[error,setError]=useState('');
 async function addDocument(){
  if(!supabase||saving)return;setError('');
  const picked=await DocumentPicker.getDocumentAsync({type:ALLOWED_TYPES,copyToCacheDirectory:true,multiple:false});
  if(picked.canceled)return;
  const file=picked.assets[0];
  if(file.size!=null&&file.size>MAX_BYTES)return setError(L('The file must be 10 MB or smaller.','Le fichier doit faire 10 Mo maximum.','El archivo debe pesar 10 MB como máximo.'));
  const mime=file.mimeType||'application/octet-stream';
  if(!ALLOWED_TYPES.includes(mime))return setError(L('Choose a PDF, JPG, PNG or WEBP file.','Choisissez un fichier PDF, JPG, PNG ou WEBP.','Elige un archivo PDF, JPG, PNG o WEBP.'));
  setSaving(true);let storagePath='';
  try{
   const{data:{user}}=await supabase.auth.getUser();if(!user)throw new Error(L('Session expired','Session expirée','Sesión caducada'));
   const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(-100)||'document';
   storagePath=`${user.id}/${Date.now()}-${safeName}`;
   const body=await (await fetch(file.uri)).arrayBuffer();
   const upload=await supabase.storage.from('company-documents').upload(storagePath,body,{contentType:mime,cacheControl:'3600',upsert:false});
   if(upload.error)throw upload.error;
   const row=await supabase.from('company_verification_documents').insert({company_id:user.id,document_type:'company_registration',title:file.name,reference:file.name,storage_path:storagePath,original_name:file.name,mime_type:mime,size_bytes:file.size??body.byteLength,uploaded_at:new Date().toISOString(),status:'pending'});
   if(row.error)throw row.error;
   Alert.alert(L('Document added','Document ajouté','Documento añadido'),L('Your document was sent to MediCrew. We will email and notify you when the review is complete.','Votre document a été envoyé à MediCrew. Vous recevrez un email et une notification lorsque l’analyse sera terminée.','Tu documento se envió a MediCrew. Recibirás un correo y una notificación cuando termine la revisión.'),[{text:'OK',onPress:()=>router.replace('/pending-review' as never)}]);
  }catch(e:any){if(storagePath)await supabase.storage.from('company-documents').remove([storagePath]);setError(e?.message||L('Unable to add the document.','Impossible d’ajouter le document.','No se pudo añadir el documento.'))}finally{setSaving(false)}
 }
 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}><View style={s.content}><Text style={s.eyebrow}>{L('ORGANIZATION VERIFICATION','VÉRIFICATION ENTREPRISE','VERIFICACIÓN DE EMPRESA')}</Text><Text style={s.title}>{L('Add a document.','Ajoutez un document.','Añade un documento.')}</Text><Text style={s.sub}>{L('No specific document is required. Add any document that helps the MediCrew team verify your organization. It stays private.','Aucun document précis n’est imposé. Ajoutez simplement un document permettant à l’équipe MediCrew de vérifier votre entreprise. Il reste privé.','No se exige ningún documento específico. Añade un documento que ayude al equipo de MediCrew a verificar tu empresa. Permanecerá privado.')}</Text>{error?<View style={s.error}><Text style={s.errorText}>{error}</Text></View>:null}<View style={s.card}><View style={s.icon}><Ionicons name="document-attach-outline" size={34} color={colors.companyDark}/></View><Text style={s.cardTitle}>{L('Organization document','Document de l’entreprise','Documento de la empresa')}</Text><Text style={s.formats}>PDF · JPG · PNG · WEBP · 10 MB max</Text><Pressable disabled={saving} onPress={addDocument} style={[s.button,saving&&{opacity:.65}]}>{saving?<ActivityIndicator color={colors.white}/>:<><Ionicons name="add-circle-outline" size={20} color={colors.white}/><Text style={s.buttonText}>{L('Add document','Ajouter un document','Añadir documento')}</Text></>}</Pressable></View></View></ScrollView></SafeAreaView>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},container:{flexGrow:1,padding:24,paddingBottom:50},content:{flex:1,justifyContent:'center',width:'100%',maxWidth:680,alignSelf:'center'},eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.4,color:colors.company},title:{fontSize:34,fontWeight:'900',color:colors.ink,marginTop:8},sub:{fontSize:13,lineHeight:20,color:colors.muted,marginTop:8},card:{marginTop:24,padding:22,borderWidth:1,borderColor:colors.line,borderRadius:radii.lg,backgroundColor:colors.white,alignItems:'center'},icon:{width:72,height:72,borderRadius:36,backgroundColor:colors.companySoft,alignItems:'center',justifyContent:'center'},cardTitle:{fontSize:18,fontWeight:'900',color:colors.ink,marginTop:14},formats:{fontSize:11,color:colors.muted,marginTop:5},button:{height:54,borderRadius:radii.md,backgroundColor:colors.companyDark,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,marginTop:22,width:'100%'},buttonText:{fontSize:14,fontWeight:'900',color:colors.white},error:{marginTop:15,padding:12,borderRadius:radii.md,backgroundColor:'#FDECEC'},errorText:{fontSize:12,color:'#A33A3A'}});
