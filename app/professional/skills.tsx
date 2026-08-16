import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, radii } from '../../lib/theme';
import { skillCatalog, skillLevels, SkillLevel } from '../../lib/professional';
import { supabase } from '../../lib/supabase';

export default function Skills(){
  const [selected,setSelected]=useState<Record<string,SkillLevel>>({});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const groups=useMemo(()=>Array.from(new Set(skillCatalog.map(s=>s.category))),[]);

  useEffect(()=>{(async()=>{
    if(!supabase){setLoading(false);return;}
    const {data,error}=await supabase.rpc('get_my_professional_details');
    if(!error && data?.skills){
      const next:Record<string,SkillLevel>={};
      for(const item of data.skills as Array<{slug:string;level:SkillLevel}>){next[item.slug]=item.level;}
      setSelected(next);
    }
    setLoading(false);
  })()},[]);

  const save=async()=>{
    if(!supabase)return;
    setSaving(true);
    const skills=skillCatalog.filter(s=>selected[s.id]).map(s=>({skill_id:s.id,level:selected[s.id],years:0}));
    const {error}=await supabase.rpc('replace_my_skills',{p_skills:skills});
    setSaving(false);
    if(error){Alert.alert('Could not save skills',error.message);return;}
    router.back();
  };

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}><Pressable onPress={()=>router.back()}><Text style={styles.back}>‹ Profile</Text></Pressable><Text style={styles.eyebrow}>CLINICAL PROFILE</Text><Text style={styles.title}>Skills & experience</Text><Text style={styles.sub}>Add only skills you can accurately demonstrate. Verified skills may be used for mission eligibility.</Text>{loading?<ActivityIndicator style={{marginTop:40}} size="large" color={colors.green}/>:groups.map(category=><View key={category} style={styles.group}><Text style={styles.groupTitle}>{category}</Text>{skillCatalog.filter(s=>s.category===category).map(skill=><View key={skill.id} style={styles.skill}><View style={styles.skillHead}><Text style={styles.skillName}>{skill.name}</Text>{selected[skill.id]&&<Text style={styles.selected}>ADDED</Text>}</View><View style={styles.levels}>{skillLevels.map(level=><Pressable key={level.id} onPress={()=>setSelected({...selected,[skill.id]:level.id})} style={[styles.level,selected[skill.id]===level.id&&styles.levelActive]}><Text style={[styles.levelText,selected[skill.id]===level.id&&styles.levelTextActive]}>{level.label}</Text></Pressable>)}</View></View>)}</View>)}<Pressable disabled={saving||loading} style={[styles.button,(saving||loading)&&styles.disabled]} onPress={save}><Text style={styles.buttonText}>{saving?'Saving…':'Save skills'}</Text></Pressable></ScrollView></SafeAreaView>
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},container:{padding:24,paddingBottom:50},back:{fontSize:16,fontWeight:'800',color:colors.ink,marginBottom:25},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.4,color:colors.green},title:{fontSize:35,fontWeight:'800',color:colors.ink,letterSpacing:-1.1,marginTop:7},sub:{fontSize:14,lineHeight:21,color:colors.muted,marginTop:9},group:{marginTop:26},groupTitle:{fontSize:16,fontWeight:'800',color:colors.ink,marginBottom:9},skill:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,padding:14,marginBottom:9},skillHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},skillName:{fontSize:13,fontWeight:'800',color:colors.ink,flex:1},selected:{fontSize:8,fontWeight:'900',letterSpacing:.8,color:colors.green},levels:{flexDirection:'row',gap:6,marginTop:11},level:{paddingHorizontal:9,paddingVertical:7,borderRadius:radii.pill,borderWidth:1,borderColor:colors.line},levelActive:{backgroundColor:colors.ink,borderColor:colors.ink},levelText:{fontSize:9,fontWeight:'700',color:colors.muted},levelTextActive:{color:colors.white},button:{height:56,borderRadius:radii.md,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center',marginTop:22},disabled:{opacity:.55},buttonText:{fontSize:16,fontWeight:'800',color:colors.white}});
