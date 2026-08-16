import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, radii } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

const fields = [
  ['first_name','First name'], ['last_name','Last name'], ['phone','Phone'], ['nationality','Nationality'],
  ['address','Address'], ['specialty','Specialty'], ['rpps_number','RPPS number'],
  ['years_experience','Years of experience'], ['medical_transport_years','Medical transport years'],
  ['air_ambulance_years','Air ambulance years'], ['repatriation_years','Repatriation years'],
  ['emergency_years','Emergency / ED years'], ['icu_years','ICU / critical care years'],
] as const;

export default function EditProfessionalProfile() {
  const [form, setForm] = useState<Record<string,string>>({});
  const [type, setType] = useState<'doctor'|'nurse'>('doctor');
  const [international, setInternational] = useState(false);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  useEffect(() => { load(); }, []);
  async function load() {
    try {
      if (!supabase) throw new Error('Supabase is not configured');
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Session expired');
      const [{ data: p, error: pe }, { data: pro, error: pre }] = await Promise.all([
        supabase.from('profiles').select('first_name,last_name,phone').eq('id', user.id).single(),
        supabase.from('professionals').select('professional_type,address,nationality,specialty,rpps_number,years_experience,medical_transport_years,air_ambulance_years,repatriation_years,emergency_years,icu_years,international_available').eq('id', user.id).single(),
      ]);
      if (pe) throw pe; if (pre) throw pre;
      const next: Record<string,string> = {}; for (const f of fields) next[f[0]] = String((p as any)?.[f[0]] ?? (pro as any)?.[f[0]] ?? '');
      setForm(next); setType(pro.professional_type); setInternational(!!pro.international_available);
    } catch (e:any) { Alert.alert('Profile unavailable', e?.message || 'Unable to load profile'); router.back(); } finally { setLoading(false); }
  }
  const set = (key:string, value:string) => setForm(x => ({...x,[key]:value}));
  async function save() {
    if (!supabase) return; setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Session expired');
      const profilePayload = { first_name: form.first_name?.trim() || null, last_name: form.last_name?.trim() || null, phone: form.phone?.trim() || null };
      const professionalPayload:any = { professional_type:type,address:form.address?.trim()||null,nationality:form.nationality?.trim()||null,specialty:form.specialty?.trim()||null,rpps_number:form.rpps_number?.trim()||null,international_available:international };
      for (const key of ['years_experience','medical_transport_years','air_ambulance_years','repatriation_years','emergency_years','icu_years']) { const n=Number(form[key]||0); if(!Number.isFinite(n)||n<0) throw new Error(`Invalid value for ${key.replaceAll('_',' ')}`); professionalPayload[key]=n; }
      const {error:pe}=await supabase.from('profiles').update(profilePayload).eq('id',user.id); if(pe) throw pe;
      const {error:pre}=await supabase.from('professionals').update(professionalPayload).eq('id',user.id); if(pre) throw pre;
      Alert.alert('Saved','Your professional profile has been updated.',[{text:'Done',onPress:()=>router.back()}]);
    } catch(e:any){Alert.alert('Save failed',e?.message||'Unable to save profile');} finally{setSaving(false);}
  }
  if(loading)return <SafeAreaView style={s.safe}><ActivityIndicator style={{marginTop:80}} size="large" color={colors.green}/></SafeAreaView>;
  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled"><Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Profile</Text></Pressable><Text style={s.eyebrow}>PROFESSIONAL PROFILE</Text><Text style={s.title}>Your details.</Text><Text style={s.sub}>Keep your professional information accurate. Verification may be required for regulated credentials.</Text><Text style={s.section}>Profession</Text><View style={s.choices}><Pressable onPress={()=>setType('doctor')} style={[s.choice,type==='doctor'&&s.active]}><Text style={s.choiceTitle}>Doctor</Text></Pressable><Pressable onPress={()=>setType('nurse')} style={[s.choice,type==='nurse'&&s.active]}><Text style={s.choiceTitle}>Nurse</Text></Pressable></View>{fields.map(([key,label])=><View key={key} style={s.field}><Text style={s.label}>{label}</Text><TextInput value={form[key]||''} onChangeText={v=>set(key,v)} keyboardType={key.includes('years')?'decimal-pad':'default'} placeholder={label} placeholderTextColor="#9AA19F" style={s.input}/></View>)}<View style={s.switchRow}><View style={{flex:1}}><Text style={s.label}>International missions</Text><Text style={s.help}>Allow international missions to match you.</Text></View><Switch value={international} onValueChange={setInternational}/></View><Pressable disabled={saving} style={[s.button,saving&&{opacity:.6}]} onPress={save}><Text style={s.buttonText}>{saving?'Saving…':'Save profile'}</Text></Pressable></ScrollView></SafeAreaView>;
}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},container:{padding:24,paddingBottom:50},back:{fontSize:16,fontWeight:'800',color:colors.ink,marginBottom:24},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.5,color:colors.green},title:{fontSize:34,fontWeight:'900',color:colors.ink,marginTop:8},sub:{fontSize:14,lineHeight:21,color:colors.muted,marginTop:8,marginBottom:20},section:{fontSize:16,fontWeight:'900',color:colors.ink,marginBottom:10},choices:{flexDirection:'row',gap:10,marginBottom:18},choice:{flex:1,padding:15,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,backgroundColor:colors.white},active:{borderColor:colors.green,backgroundColor:colors.greenSoft},choiceTitle:{fontWeight:'800',textAlign:'center',color:colors.ink},field:{marginBottom:14},label:{fontSize:12,fontWeight:'800',color:colors.ink,marginBottom:7},input:{height:52,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,backgroundColor:colors.white,paddingHorizontal:14,fontSize:15,color:colors.ink},switchRow:{flexDirection:'row',alignItems:'center',paddingVertical:14,borderTopWidth:1,borderBottomWidth:1,borderColor:colors.line},help:{fontSize:11,color:colors.muted,marginTop:3},button:{height:56,borderRadius:radii.md,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center',marginTop:20},buttonText:{fontSize:16,fontWeight:'900',color:colors.white}});