import { Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { colors, radii } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<any>(null);
  const [professional, setProfessional] = useState<any>(null);
  const [skills, setSkills] = useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      if (!supabase) throw new Error('Supabase is not configured');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in again');

      const [{ data: p, error: pe }, { data: pro, error: pre }, { data: sk, error: se }] = await Promise.all([
        supabase.from('profiles').select('first_name,last_name,email,phone,avatar_url').eq('id', user.id).maybeSingle(),
        supabase.from('professionals').select('professional_type,date_of_birth,address,nationality,specialty,rpps_number,years_experience,medical_transport_years,air_ambulance_years,repatriation_years,emergency_years,icu_years,verification_status,available_now,international_available').eq('id', user.id).maybeSingle(),
        supabase.from('professional_skills').select('experience_level,years_experience,verified,skills(slug,name)').eq('professional_id', user.id),
      ]);
      if (pe) throw pe;
      if (pre) throw pre;
      if (se) throw se;
      if (!p || !pro) throw new Error('Professional profile is not available yet');
      setProfile(p);
      setProfessional(pro);
      setSkills(sk || []);
    } catch (e: any) {
      setError(e?.message || 'Unable to load professional profile');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <SafeAreaView style={styles.safe}><ActivityIndicator style={{ marginTop: 80 }} size="large" color={colors.green} /></SafeAreaView>;
  if (error) return <SafeAreaView style={styles.safe}><View style={styles.container}><Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.errorTitle}>Profile unavailable</Text><Text style={styles.errorText}>{error}</Text><Pressable style={styles.secondary} onPress={load}><Text style={styles.secondaryText}>Try again</Text></Pressable></View></SafeAreaView>;

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Professional';
  const role = professional.professional_type === 'nurse' ? 'Nurse' : 'Doctor';
  const status = professional.verification_status;

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.container}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
      <View style={styles.header}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{fullName.split(' ').map((x:string) => x[0]).join('').slice(0,2).toUpperCase()}</Text></View>
        <View style={styles.headText}><Text style={styles.name}>{fullName}</Text><Text style={styles.role}>{role}{professional.specialty ? ` · ${professional.specialty}` : ''}</Text><View style={[styles.verified, status !== 'verified' && styles.pending]}><Text style={[styles.verifiedText, status !== 'verified' && styles.pendingText]}>{status === 'verified' ? '✓ VERIFIED PROFESSIONAL' : status.toUpperCase()}</Text></View></View>
      </View>

      <Card title="Professional details">
        <Row label="Experience" value={`${professional.years_experience ?? 0} years`} />
        <Row label="Medical transport" value={`${professional.medical_transport_years ?? 0} years`} />
        <Row label="Air ambulance" value={`${professional.air_ambulance_years ?? 0} years`} />
        <Row label="Repatriation" value={`${professional.repatriation_years ?? 0} years`} />
        <Row label="Emergency" value={`${professional.emergency_years ?? 0} years`} />
        <Row label="ICU / critical care" value={`${professional.icu_years ?? 0} years`} />
        <Row label="International" value={professional.international_available ? 'Yes' : 'No'} />
      </Card>

      <Card title={`Clinical & transport skills · ${skills.length}`}>
        {skills.length === 0 ? <Text style={styles.empty}>No skills added yet.</Text> : skills.map((s) => <Skill key={s.skills?.slug} name={s.skills?.name || s.skills?.slug || 'Skill'} level={s.experience_level} verified={s.verified} />)}
      </Card>

      <Card title="Account">
        <Row label="Email" value={profile.email || '—'} />
        <Row label="Phone" value={profile.phone || '—'} />
        <Row label="RPPS" value={professional.rpps_number || 'Not provided'} />
        <Row label="Nationality" value={professional.nationality || 'Not provided'} />
      </Card>

      <Pressable style={styles.secondary} onPress={() => router.push('/professional/skills')}><Text style={styles.secondaryText}>Manage skills & certifications</Text></Pressable>
      <Pressable style={styles.secondary} onPress={() => router.push('/availability')}><Text style={styles.secondaryText}>Manage availability</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text>{children}</View>; }
function Row({ label, value }: { label: string; value: string }) { return <View style={styles.row}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>; }
function Skill({ name, level, verified }: { name: string; level: string; verified: boolean }) { return <View style={styles.skill}><Text style={styles.skillName}>{name}</Text><Text style={styles.level}>{level}{verified ? ' · ✓' : ''}</Text></View>; }

const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:colors.paper},container:{padding:24,paddingBottom:40},back:{fontSize:16,fontWeight:'800',color:colors.ink,marginBottom:25},header:{flexDirection:'row',alignItems:'center'},avatar:{width:64,height:64,borderRadius:32,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center'},avatarText:{fontSize:18,fontWeight:'900',color:colors.white},headText:{marginLeft:14,flex:1},name:{fontSize:23,fontWeight:'800',color:colors.ink},role:{fontSize:13,color:colors.muted,marginTop:3},verified:{alignSelf:'flex-start',marginTop:8,paddingHorizontal:8,paddingVertical:5,borderRadius:radii.pill,backgroundColor:colors.greenSoft},verifiedText:{fontSize:8,fontWeight:'900',letterSpacing:.7,color:colors.green},pending:{backgroundColor:colors.line},pendingText:{color:colors.muted},card:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:radii.lg,padding:18,marginTop:18},cardTitle:{fontSize:17,fontWeight:'800',color:colors.ink,marginBottom:12},row:{flexDirection:'row',justifyContent:'space-between',paddingVertical:7},label:{fontSize:13,color:colors.muted},value:{fontSize:13,fontWeight:'800',color:colors.ink,maxWidth:'65%',textAlign:'right'},skill:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:10,borderBottomWidth:1,borderBottomColor:colors.line},skillName:{fontSize:13,fontWeight:'700',color:colors.ink,flex:1},level:{fontSize:11,fontWeight:'800',color:colors.green},empty:{fontSize:13,color:colors.muted},errorTitle:{fontSize:24,fontWeight:'900',color:colors.ink,marginTop:30},errorText:{fontSize:14,color:colors.muted,marginTop:8,lineHeight:21},secondary:{height:54,borderRadius:radii.md,borderWidth:1,borderColor:colors.line,backgroundColor:colors.white,alignItems:'center',justifyContent:'center',marginTop:12},secondaryText:{fontSize:14,fontWeight:'800',color:colors.ink}});
