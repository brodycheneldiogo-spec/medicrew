import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, radii } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

const ALLOWED=['application/pdf','image/jpeg','image/png','image/webp'];
const MAX=10*1024*1024;

export default function Passport(){
  const { required }=useLocalSearchParams<{required?:string}>();
  const [nationality,setNationality]=useState('');
  const [expires,setExpires]=useState('');
  const [picked,setPicked]=useState<DocumentPicker.DocumentPickerAsset|null>(null);
  const [existing,setExisting]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{load()},[]);
  async function load(){
    if(!supabase)return;
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){setError('Session expired');setLoading(false);return}
    const [{data:pro},{data:docs}]=await Promise.all([
      supabase.from('professionals').select('nationality').eq('id',user.id).maybeSingle(),
      supabase.from('professional_documents').select('id,title,status,expires_at').eq('professional_id',user.id).in('document_type',['passport','identity']).ilike('title','%passport%').order('created_at',{ascending:false}).limit(1)
    ]);
    setNationality(pro?.nationality||'');
    setExisting(docs?.[0]||null);
    setLoading(false);
  }
  async function pick(){
    setError('');
    const result=await DocumentPicker.getDocumentAsync({type:ALLOWED,copyToCacheDirectory:true,multiple:false});
    if(result.canceled)return;
    const asset=result.assets[0];
    if((asset.size||0)>MAX){setError('Passport file is too large. Maximum size is 10 MB.');return}
    if(asset.mimeType&&!ALLOWED.includes(asset.mimeType)){setError('Use PDF, JPG, PNG or WEBP.');return}
    setPicked(asset);
  }
  async function submit(){
    if(!supabase)return;
    const nat=nationality.trim();
    if(!nat)return setError('Nationality is required.');
    if(!existing&&!picked)return setError('Upload your passport to continue.');
    if(expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires.trim()))return setError('Use passport expiry format YYYY-MM-DD.');
    setSaving(true);setError('');
    try{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user)throw new Error('Session expired');
      const {error:pe}=await supabase.from('professionals').update({nationality:nat}).eq('id',user.id);
      if(pe)throw pe;
      if(picked){
        const safeName=picked.name.replace(/[^a-zA-Z0-9._-]/g,'_');
        const storagePath=`${user.id}/passport-${Date.now()}-${safeName}`;
        const file=new File(picked.uri);
        const body=await file.arrayBuffer();
        const upload=await supabase.storage.from('professional-documents').upload(storagePath,body,{contentType:picked.mimeType||'application/octet-stream',cacheControl:'3600',upsert:false});
        if(upload.error)throw upload.error;
        const {error:de}=await supabase.from('professional_documents').insert({professional_id:user.id,document_type:'passport',title:'Passport',expires_at:expires.trim()||null,storage_path:storagePath,original_name:picked.name,mime_type:picked.mimeType||null,size_bytes:picked.size||null,uploaded_at:new Date().toISOString(),status:'pending'});
        if(de){await supabase.storage.from('professional-documents').remove([storagePath]);throw de}
      }
      Alert.alert('Passport submitted','Your passport and nationality are saved. An administrator must verify the document before it can be used as verified eligibility evidence.',[{text:'Continue',onPress:()=>router.replace('/home')}]);
    }catch(e:any){setError(e?.message||'Unable to save passport details')}
    finally{setSaving(false)}
  }
  if(loading)return <SafeAreaView style={s.safe}><ActivityIndicator style={{marginTop:90}} size="large" color={colors.green}/></SafeAreaView>;
  const verified=existing?.status==='verified';
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
    <Text style={s.eyebrow}>IDENTITY & VISA READINESS</Text>
    <Text style={s.title}>{required?'Passport required.':'Passport details.'}</Text>
    <Text style={s.sub}>MediCrew stores the passport privately for verification. Companies see your nationality and whether a valid passport has been verified; they never see your passport number or file.</Text>
    {error?<View style={s.error}><Text style={s.errorText}>{error}</Text></View>:null}
    <View style={s.card}>
      <Text style={s.label}>Nationality</Text>
      <TextInput value={nationality} onChangeText={setNationality} autoCapitalize="words" placeholder="e.g. French" style={s.input}/>
      <Text style={s.label}>Passport expiry date</Text>
      <TextInput value={expires} onChangeText={setExpires} placeholder="YYYY-MM-DD" style={s.input}/>
      {existing?<View style={s.existing}><Text style={s.existingTitle}>Passport already submitted</Text><Text style={s.existingText}>{verified?'Verified':'Pending verification'}{existing.expires_at?` · expires ${existing.expires_at}`:''}</Text></View>:null}
      {!verified?<Pressable style={s.upload} onPress={pick}><Text style={s.uploadIcon}>＋</Text><View style={{flex:1}}><Text style={s.uploadTitle}>{picked?'Passport selected':'Upload passport'}</Text><Text style={s.uploadText}>{picked?picked.name:'PDF, JPG, PNG or WEBP · max 10 MB'}</Text></View><Text style={s.arrow}>›</Text></Pressable>:null}
      <Pressable disabled={saving} style={[s.button,saving&&{opacity:.6}]} onPress={submit}>{saving?<ActivityIndicator color={colors.white}/>:<Text style={s.buttonText}>{verified?'Save nationality':'Submit passport'}</Text>}</Pressable>
    </View>
    <Text style={s.legal}>Passport information is collected only for identity/verification and legitimate mission logistics such as international travel eligibility. Do not upload documents that are not yours. MediCrew does not make immigration or visa decisions.</Text>
  </ScrollView></SafeAreaView>
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},container:{padding:24,paddingBottom:50},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.5,color:colors.green},title:{fontSize:34,fontWeight:'900',color:colors.ink,marginTop:8},sub:{fontSize:14,lineHeight:21,color:colors.muted,marginTop:8,marginBottom:18},card:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:radii.lg,padding:18},label:{fontSize:12,fontWeight:'800',color:colors.ink,marginTop:10,marginBottom:7},input:{height:50,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,paddingHorizontal:13,color:colors.ink,backgroundColor:'#FAFBFA'},existing:{marginTop:14,padding:12,borderRadius:12,backgroundColor:colors.greenSoft},existingTitle:{fontSize:12,fontWeight:'900',color:colors.ink},existingText:{fontSize:11,color:colors.muted,marginTop:3},upload:{marginTop:16,borderWidth:1,borderColor:'#BFE8D7',borderRadius:radii.md,padding:13,backgroundColor:colors.greenSoft,flexDirection:'row',alignItems:'center',gap:10},uploadIcon:{fontSize:25,color:colors.greenDark,fontWeight:'700'},uploadTitle:{fontSize:13,fontWeight:'900',color:colors.ink},uploadText:{fontSize:10,color:colors.muted,marginTop:3},arrow:{fontSize:25,color:colors.greenDark},button:{height:54,borderRadius:radii.md,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center',marginTop:18},buttonText:{fontSize:14,fontWeight:'900',color:colors.white},error:{backgroundColor:'#FDECEC',padding:12,borderRadius:12,marginBottom:12},errorText:{fontSize:12,color:'#A33A3A'},legal:{fontSize:10,lineHeight:16,color:colors.muted,textAlign:'center',marginTop:16}});
