import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, radii } from '../lib/theme';
import { supabase } from '../lib/supabase';

export default function Onboarding() {
  const { role } = useLocalSearchParams<{ role: 'professional' | 'company' }>();
  const [step,setStep]=useState(0); const [type,setType]=useState<'doctor'|'nurse'>('doctor'); const [name,setName]=useState(''); const [location,setLocation]=useState(''); const [saving,setSaving]=useState(false);
  const professional=role!=='company'; const total=professional?3:2;
  const title=professional?['Tell us about you.','What do you do?','Where can you operate?'][step]:['Tell us about your company.','Where are you based?'][step];
  async function next(){
    if(step<total-1){setStep(step+1);return;}
    if(!supabase)return Alert.alert('Supabase not configured','Connect Supabase before completing onboarding.');
    const {data:{user}}=await supabase.auth.getUser(); if(!user)return Alert.alert('Session expired','Please sign in again.');
    setSaving(true);
    const parts=name.trim().split(/\s+/).filter(Boolean); const first=parts[0]||null; const last=parts.slice(1).join(' ')||null;
    let error:any=null;
    if(professional){
      const p=await supabase.from('profiles').update({first_name:first,last_name:last}).eq('id',user.id); if(p.error)error=p.error;
      if(!error){const r=await supabase.from('professionals').upsert({id:user.id,professional_type:type,available_now:false,international_available:false},{onConflict:'id'}); error=r.error;}
    }else{
      const p=await supabase.from('profiles').update({first_name:first}).eq('id',user.id); if(p.error)error=p.error;
      if(!error){const r=await supabase.from('companies').upsert({id:user.id,company_name:name.trim()||'Unnamed company',address:location.trim()||null,contact_name:first||null},{onConflict:'id'}); error=r.error;}
    }
    setSaving(false); if(error)return Alert.alert('Could not save setup',error.message); router.replace(professional?'/home':'/company');
  }
  return <SafeAreaView style={styles.safe}><View style={styles.container}><View><Text style={styles.progress}>{step+1} / {total}</Text><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>You can complete the remaining verification details later.</Text></View><View>
    {professional&&step===0&&<><Text style={styles.label}>Full name</Text><TextInput value={name} onChangeText={setName} placeholder="First and last name" placeholderTextColor="#9AA19F" style={styles.input}/></>}
    {professional&&step===1&&<View style={styles.choices}><Pressable onPress={()=>setType('doctor')} style={[styles.choice,type==='doctor'&&styles.active]}><Text style={styles.choiceTitle}>Doctor</Text><Text style={styles.choiceText}>Medical doctor</Text></Pressable><Pressable onPress={()=>setType('nurse')} style={[styles.choice,type==='nurse'&&styles.active]}><Text style={styles.choiceTitle}>Nurse</Text><Text style={styles.choiceText}>Registered nurse</Text></Pressable></View>}
    {professional&&step===2&&<><Text style={styles.label}>Starting location</Text><TextInput value={location} onChangeText={setLocation} placeholder="City, country" placeholderTextColor="#9AA19F" style={styles.input}/></>}
    {!professional&&step===0&&<><Text style={styles.label}>Legal company name</Text><TextInput value={name} onChangeText={setName} placeholder="Company name" placeholderTextColor="#9AA19F" style={styles.input}/></>}
    {!professional&&step===1&&<><Text style={styles.label}>Headquarters</Text><TextInput value={location} onChangeText={setLocation} placeholder="City, country" placeholderTextColor="#9AA19F" style={styles.input}/></>}
    <Pressable disabled={saving} style={[styles.button,saving&&{opacity:.6}]} onPress={next}><Text style={styles.buttonText}>{saving?'Saving…':step===total-1?'Finish setup':'Continue'}</Text></Pressable>
  </View><Text style={styles.footer}>MediCrew verification protects the marketplace.</Text></View></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},container:{flex:1,padding:24,justifyContent:'space-between'},progress:{fontSize:12,fontWeight:'800',color:colors.green,letterSpacing:1.2},title:{fontSize:38,lineHeight:42,fontWeight:'800',color:colors.ink,letterSpacing:-1.2,marginTop:12},subtitle:{fontSize:16,lineHeight:24,color:colors.muted,marginTop:12},label:{fontSize:13,fontWeight:'700',color:colors.ink,marginBottom:8},input:{height:54,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,backgroundColor:colors.white,paddingHorizontal:15,fontSize:16,color:colors.ink},choices:{gap:12},choice:{padding:18,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,backgroundColor:colors.white},active:{borderColor:colors.green,backgroundColor:colors.greenSoft},choiceTitle:{fontSize:17,fontWeight:'800',color:colors.ink},choiceText:{fontSize:13,color:colors.muted,marginTop:4},button:{height:56,borderRadius:radii.md,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center',marginTop:18},buttonText:{color:colors.white,fontSize:16,fontWeight:'800'},footer:{fontSize:12,color:colors.muted,textAlign:'center'}});
