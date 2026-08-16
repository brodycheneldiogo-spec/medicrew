import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radii } from '../lib/theme';

export default function Welcome() {
  const [role, setRole] = useState<'professional' | 'company' | null>(null);
  return <SafeAreaView style={styles.safe}><View style={styles.container}>
    <View style={styles.brandRow}><View style={styles.mark}><View style={styles.markInner}/></View><Text style={styles.wordmark}>MediCrew</Text></View>
    <View style={styles.hero}><Text style={styles.eyebrow}>MEDICAL TRANSPORT</Text><Text style={styles.title}>The right medical professional. When the mission needs them.</Text><Text style={styles.subtitle}>A verified network for medical transport companies and qualified doctors and nurses.</Text></View>
    <View style={styles.card}><Text style={styles.cardTitle}>How will you use MediCrew?</Text>
      <Pressable style={[styles.choice, role==='professional'&&styles.choiceActive]} onPress={()=>setRole('professional')}><View><Text style={styles.choiceTitle}>I'm a medical professional</Text><Text style={styles.choiceText}>Find and accept transport missions</Text></View><Text style={styles.chevron}>›</Text></Pressable>
      <Pressable style={[styles.choice, role==='company'&&styles.choiceActive]} onPress={()=>setRole('company')}><View><Text style={styles.choiceTitle}>I'm a company</Text><Text style={styles.choiceText}>Find qualified professionals for missions</Text></View><Text style={styles.chevron}>›</Text></Pressable>
    </View>
    <Pressable disabled={!role} style={[styles.button,!role&&styles.buttonDisabled]} onPress={()=>role==='company'?router.push('/company'):router.push({pathname:'/auth',params:{role}})}><Text style={styles.buttonText}>Continue</Text></Pressable>
    <Text style={styles.footer}>MediCrew • Built for medical transport</Text>
  </View></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},container:{flex:1,padding:24,justifyContent:'space-between'},brandRow:{flexDirection:'row',alignItems:'center',gap:10},mark:{width:38,height:38,borderRadius:12,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center'},markInner:{width:15,height:15,borderRadius:8,backgroundColor:colors.green},wordmark:{fontSize:20,fontWeight:'800',color:colors.ink,letterSpacing:-.5},hero:{marginTop:24},eyebrow:{color:colors.green,fontWeight:'800',letterSpacing:1.5,fontSize:12,marginBottom:14},title:{fontSize:42,lineHeight:45,fontWeight:'800',color:colors.ink,letterSpacing:-1.7},subtitle:{marginTop:18,color:colors.muted,fontSize:17,lineHeight:25},card:{backgroundColor:colors.white,borderRadius:radii.lg,padding:18,borderWidth:1,borderColor:colors.line},cardTitle:{fontSize:16,fontWeight:'700',color:colors.ink,marginBottom:8},choice:{padding:15,borderRadius:radii.md,borderWidth:1,borderColor:colors.line,marginTop:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},choiceActive:{borderColor:colors.green,backgroundColor:colors.greenSoft},choiceTitle:{fontSize:15,fontWeight:'700',color:colors.ink},choiceText:{fontSize:13,color:colors.muted,marginTop:3},chevron:{fontSize:25,color:colors.muted},button:{backgroundColor:colors.ink,height:56,borderRadius:radii.md,alignItems:'center',justifyContent:'center',marginTop:16},buttonDisabled:{opacity:.35},buttonText:{color:colors.white,fontSize:16,fontWeight:'800'},footer:{textAlign:'center',color:colors.muted,fontSize:12,marginTop:12}});
