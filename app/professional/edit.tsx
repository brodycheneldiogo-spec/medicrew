import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, radii } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

export default function EditProfessionalProfile() {
  const [form, setForm] = useState<Record<string,string>>({ first_name:'', last_name:'', phone:'', nationality:'', address:'' });
  const [international, setInternational] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      if (!supabase) throw new Error('Supabase is not configured');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired');
      const [{ data: p, error: pe }, { data: pro, error: pre }] = await Promise.all([
        supabase.from('profiles').select('first_name,last_name,phone').eq('id', user.id).single(),
        supabase.from('professionals').select('nationality,address,international_available,verification_status,professional_type,specialty,rpps_number,years_experience,medical_transport_years,air_ambulance_years,repatriation_years,emergency_years,icu_years').eq('id', user.id).single(),
      ]);
      if (pe) throw pe; if (pre) throw pre;
      setForm({ first_name:p.first_name || '', last_name:p.last_name || '', phone:p.phone || '', nationality:pro.nationality || '', address:pro.address || '' });
      setInternational(!!pro.international_available);
      setVerificationStatus(pro.verification_status || 'pending');
    } catch (e:any) {
      Alert.alert('Profile unavailable', e?.message || 'Unable to load profile');
      router.back();
    } finally { setLoading(false); }
  }

  const set = (key:string, value:string) => setForm(x => ({ ...x, [key]:value }));

  async function save() {
    if (!supabase) return;
    setSaving(true);
    try {
      const { data:{user} } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired');
      const { error } = await supabase.from('profiles').update({
        first_name:form.first_name.trim() || null,
        last_name:form.last_name.trim() || null,
        phone:form.phone.trim() || null,
      }).eq('id', user.id);
      if (error) throw error;

      const { error: professionalError } = await supabase.from('professionals').update({
        nationality:form.nationality.trim() || null,
        address:form.address.trim() || null,
        international_available:international,
      }).eq('id', user.id);
      if (professionalError) throw professionalError;

      Alert.alert('Saved','Your contact and non-regulated profile details have been updated.',[{text:'Done',onPress:()=>router.back()}]);
    } catch(e:any) {
      Alert.alert('Save failed',e?.message||'Unable to save profile');
    } finally { setSaving(false); }
  }

  if(loading) return <SafeAreaView style={s.safe}><ActivityIndicator style={{marginTop:80}} size="large" color={colors.green}/></SafeAreaView>;

  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
    <Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Profile</Text></Pressable>
    <Text style={s.eyebrow}>PROFESSIONAL PROFILE</Text>
    <Text style={s.title}>Your details.</Text>
    <Text style={s.sub}>Keep your contact and personal details accurate. Regulated professional credentials are controlled by verification.</Text>

    <Section title="Contact">
      <Field label="First name" value={form.first_name} onChange={v=>set('first_name',v)}/>
      <Field label="Last name" value={form.last_name} onChange={v=>set('last_name',v)}/>
      <Field label="Phone" value={form.phone} onChange={v=>set('phone',v)} keyboardType="phone-pad"/>
    </Section>

    <Section title="Personal details">
      <Field label="Nationality" value={form.nationality} onChange={v=>set('nationality',v)}/>
      <Field label="Address" value={form.address} onChange={v=>set('address',v)}/>
    </Section>

    <Section title="Professional identity">
      <ReadOnly label="Profession" value="Your verified professional type" />
      <ReadOnly label="Specialty" value="Managed through verification" />
      <ReadOnly label="RPPS number" value="Managed through verification" />
      <ReadOnly label="Experience" value="Managed through verification" />
      <View style={s.notice}><Text style={s.noticeTitle}>Why is this locked?</Text><Text style={s.noticeText}>Profession, specialty, RPPS and experience affect mission eligibility. They cannot be changed directly after verification; request a verification update instead.</Text></View>
      <Text style={s.status}>Verification status: <Text style={s.statusValue}>{verificationStatus}</Text></Text>
    </Section>

    <View style={s.switchRow}><View style={{flex:1}}><Text style={s.label}>International missions</Text><Text style={s.help}>Allow international missions to match you.</Text></View><Switch value={international} onValueChange={setInternational}/></View>
    <Pressable disabled={saving} style={[s.button,saving&&{opacity:.6}]} onPress={save}><Text style={s.buttonText}>{saving?'Saving…':'Save profile'}</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

function Section({title,children}:{title:string;children:React.ReactNode}){return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{children}</View>}
function Field({label,value,onChange,keyboardType}:{label:string;value:string;onChange:(v:string)=>void;keyboardType?:'default'|'phone-pad'}){return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChange} keyboardType={keyboardType||'default'} placeholder={label} placeholderTextColor="#9AA19F" style={s.input}/></View>}
function ReadOnly({label,value}:{label:string;value:string}){return <View style={s.field}><Text style={s.label}>{label}</Text><View style={s.readOnly}><Text style={s.readOnlyText}>{value}</Text><Text style={s.lock}>LOCKED</Text></View></View>}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},container:{padding:24,paddingBottom:50},back:{fontSize:16,fontWeight:'800',color:colors.ink,marginBottom:24},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.5,color:colors.green},title:{fontSize:34,fontWeight:'900',color:colors.ink,marginTop:8},sub:{fontSize:14,lineHeight:21,color:colors.muted,marginTop:8,marginBottom:20},section:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:radii.lg,padding:17,marginBottom:13},sectionTitle:{fontSize:16,fontWeight:'900',color:colors.ink,marginBottom:13},field:{marginBottom:12},label:{fontSize:12,fontWeight:'800',color:colors.ink,marginBottom:7},input:{height:48,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,backgroundColor:'#FAFBFA',paddingHorizontal:14,fontSize:15,color:colors.ink},readOnly:{minHeight:48,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,backgroundColor:'#F1F3F1',paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},readOnlyText:{fontSize:13,color:colors.muted,flex:1},lock:{fontSize:9,fontWeight:'900',letterSpacing:.8,color:colors.muted},notice:{backgroundColor:colors.greenSoft,borderRadius:12,padding:12,marginTop:4},noticeTitle:{fontSize:12,fontWeight:'900',color:'#117A5B'},noticeText:{fontSize:11,lineHeight:17,color:'#3C6659',marginTop:4},status:{fontSize:11,color:colors.muted,marginTop:12},statusValue:{fontWeight:'900',color:colors.ink},switchRow:{flexDirection:'row',alignItems:'center',paddingVertical:14,borderTopWidth:1,borderBottomWidth:1,borderColor:colors.line},help:{fontSize:11,color:colors.muted,marginTop:3},button:{height:56,borderRadius:radii.md,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center',marginTop:20},buttonText:{fontSize:16,fontWeight:'900',color:colors.white}});