import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors, radii } from '../lib/theme';

type Mission = { id:string; title:string; departure_location:string; destination_location:string; departure_at:string; professional_type:'doctor'|'nurse'; compensation_cents:number; status:string };
const tabs = [
  ['all','All'], ['open','Open'], ['active','Active'], ['completed','Completed'], ['cancelled','Cancelled']
] as const;

function bucket(status:string) {
  if (['published','matching'].includes(status)) return 'open';
  if (['professional_selected','confirmed','in_progress'].includes(status)) return 'active';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'cancelled';
  return 'all';
}
function statusLabel(status:string) { return status.replaceAll('_',' '); }

export default function CompanyMissions() {
  const [missions,setMissions] = useState<Mission[]>([]);
  const [tab,setTab] = useState<(typeof tabs)[number][0]>('all');
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) { setError('Database unavailable'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data:{user} } = await supabase.auth.getUser();
    if (!user) { setError('Sign in required'); setLoading(false); return; }
    const { data,error:e } = await supabase.from('missions')
      .select('id,title,departure_location,destination_location,departure_at,professional_type,compensation_cents,status')
      .eq('company_id',user.id).order('departure_at',{ascending:true});
    if (e) setError(e.message); else setMissions((data||[]) as Mission[]);
    setLoading(false);
  },[]);

  useEffect(()=>{load()},[load]);
  const filtered = useMemo(()=>tab==='all'?missions:missions.filter(m=>bucket(m.status)===tab),[missions,tab]);
  const counts = useMemo(()=>({all:missions.length,open:missions.filter(m=>bucket(m.status)==='open').length,active:missions.filter(m=>bucket(m.status)==='active').length,completed:missions.filter(m=>bucket(m.status)==='completed').length,cancelled:missions.filter(m=>bucket(m.status)==='cancelled').length}),[missions]);

  return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
    <Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Company</Text></Pressable>
    <Text style={s.eyebrow}>MISSION MANAGEMENT</Text>
    <Text style={s.title}>Your missions.</Text>
    <Text style={s.sub}>Track every transport mission from publication through completion.</Text>
    <Pressable style={s.create} onPress={()=>router.push('/company-mission')}><Text style={s.createText}>+ Create a mission</Text></Pressable>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
      {tabs.map(([id,label])=><Pressable key={id} onPress={()=>setTab(id)} style={[s.tab,tab===id&&s.tabActive]}><Text style={[s.tabText,tab===id&&s.tabTextActive]}>{label} · {counts[id]}</Text></Pressable>)}
    </ScrollView>
    {loading?<ActivityIndicator style={{marginTop:35}} size="large" color={colors.green}/>:error?<View style={s.error}><Text style={s.errorText}>{error}</Text><Pressable onPress={load}><Text style={s.retry}>Try again</Text></Pressable></View>:filtered.length===0?<View style={s.empty}><Text style={s.emptyTitle}>Nothing here yet</Text><Text style={s.emptyText}>{tab==='all'?'Create your first transport mission.':`No ${tab} missions at the moment.`}</Text></View>:filtered.map(m=><Pressable key={m.id} style={s.card} onPress={()=>router.push({pathname:'/company-candidates',params:{missionId:m.id}})}>
      <View style={s.top}><View style={{flex:1}}><Text style={s.route}>{m.departure_location} <Text style={s.arrow}>→</Text> {m.destination_location}</Text><Text style={s.meta}>{new Date(m.departure_at).toLocaleString()} · {m.professional_type==='nurse'?'Nurse':'Doctor'}</Text></View><View style={[s.status,bucket(m.status)==='cancelled'&&s.statusCancelled]}><Text style={[s.statusText,bucket(m.status)==='cancelled'&&s.statusTextCancelled]}>{statusLabel(m.status)}</Text></View></View>
      <View style={s.divider}/><View style={s.bottom}><Text style={s.titleSmall}>{m.title}</Text><Text style={s.pay}>€{(m.compensation_cents/100).toFixed(0)}</Text></View>
    </Pressable>)}
  </ScrollView></SafeAreaView>
}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},container:{padding:22,paddingBottom:50},back:{fontSize:14,fontWeight:'700',color:colors.ink,marginBottom:24},eyebrow:{fontSize:11,fontWeight:'800',letterSpacing:1.5,color:colors.green},title:{fontSize:30,fontWeight:'800',letterSpacing:-.8,color:colors.ink,marginTop:6},sub:{fontSize:13,lineHeight:19,color:colors.muted,marginTop:7,marginBottom:20},create:{backgroundColor:colors.ink,borderRadius:14,minHeight:50,alignItems:'center',justifyContent:'center',marginBottom:14},createText:{color:colors.white,fontWeight:'800',fontSize:14},tabs:{gap:8,paddingBottom:14},tab:{borderWidth:1,borderColor:colors.line,borderRadius:12,paddingHorizontal:13,paddingVertical:9,backgroundColor:colors.white},tabActive:{backgroundColor:colors.ink,borderColor:colors.ink},tabText:{fontSize:11,fontWeight:'700',color:colors.muted},tabTextActive:{color:colors.white},card:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:radii.lg,padding:17,marginBottom:10},top:{flexDirection:'row',alignItems:'flex-start'},route:{fontSize:17,fontWeight:'800',color:colors.ink},arrow:{color:colors.green},meta:{fontSize:12,color:colors.muted,marginTop:5},status:{backgroundColor:colors.greenSoft,paddingHorizontal:9,paddingVertical:6,borderRadius:9},statusCancelled:{backgroundColor:'#FDECEC'},statusText:{fontSize:10,fontWeight:'800',color:'#117A5B',textTransform:'capitalize'},statusTextCancelled:{color:colors.danger},divider:{height:1,backgroundColor:colors.line,marginVertical:14},bottom:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},titleSmall:{fontSize:13,fontWeight:'700',color:colors.ink,flex:1},pay:{fontSize:17,fontWeight:'800',color:colors.ink},empty:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:radii.lg,padding:22,marginTop:8},emptyTitle:{fontSize:17,fontWeight:'800',color:colors.ink},emptyText:{fontSize:13,color:colors.muted,lineHeight:19,marginTop:5},error:{backgroundColor:'#FDECEC',borderRadius:14,padding:16,marginTop:15},errorText:{color:colors.danger,fontSize:12},retry:{color:colors.ink,fontWeight:'800',fontSize:12,marginTop:9}});