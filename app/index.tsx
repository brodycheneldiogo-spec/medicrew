import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, gradients, radii } from '../lib/theme';
import { MediCrewLogo } from '../lib/brand';

export default function Welcome() {
  const [role, setRole] = useState<'professional' | 'company' | null>(null);
  return <SafeAreaView style={styles.safe}><LinearGradient colors={gradients.soft} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.gradient}><View style={styles.container}>
    <MediCrewLogo />
    <View style={styles.hero}>
      <Text style={styles.eyebrow}>MEDICAL TRANSPORT</Text>
      <Text style={styles.title}>The right medical professional. When the mission needs them.</Text>
      <Text style={styles.subtitle}>A verified network for medical transport companies and qualified doctors and nurses.</Text>
    </View>
    <View style={styles.card}><Text style={styles.cardTitle}>How will you use MediCrew?</Text>
      <Pressable style={[styles.choice, role==='professional'&&styles.choiceActive]} onPress={()=>setRole('professional')}><View style={styles.choiceBody}><Text style={styles.choiceTitle}>I'm a medical professional</Text><Text style={styles.choiceText}>Find and accept transport missions</Text></View><Text style={styles.chevron}>›</Text></Pressable>
      <Pressable style={[styles.choice, role==='company'&&styles.choiceActive]} onPress={()=>setRole('company')}><View style={styles.choiceBody}><Text style={styles.choiceTitle}>I'm a company</Text><Text style={styles.choiceText}>Find qualified professionals for missions</Text></View><Text style={styles.chevron}>›</Text></Pressable>
    </View>
    <Pressable disabled={!role} onPress={()=>role&&router.push({pathname:'/auth',params:{role}})}><LinearGradient colors={gradients.primary} start={{x:0,y:.5}} end={{x:1,y:.5}} style={[styles.button,!role&&styles.buttonDisabled]}><Text style={styles.buttonText}>Create an account</Text><Text style={styles.buttonArrow}>→</Text></LinearGradient></Pressable>
    <Text style={styles.footer}>MediCrew • Built for medical transport</Text>
  </View></LinearGradient></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},gradient:{flex:1},container:{flex:1,padding:24,justifyContent:'space-between'},hero:{marginTop:24},eyebrow:{color:colors.greenDark,fontWeight:'900',letterSpacing:1.5,fontSize:12,marginBottom:14},title:{fontSize:40,lineHeight:43,fontWeight:'900',color:colors.ink,letterSpacing:-1.7},subtitle:{marginTop:18,color:colors.muted,fontSize:17,lineHeight:25},card:{backgroundColor:colors.white,borderRadius:radii.lg,padding:18,borderWidth:1,borderColor:colors.line},cardTitle:{fontSize:16,fontWeight:'800',color:colors.ink,marginBottom:8},choice:{padding:15,borderRadius:radii.md,borderWidth:1,borderColor:colors.line,marginTop:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},choiceActive:{borderColor:colors.green,backgroundColor:colors.greenSoft},choiceBody:{flex:1},choiceTitle:{fontSize:15,fontWeight:'800',color:colors.ink},choiceText:{fontSize:13,color:colors.muted,marginTop:3},chevron:{fontSize:25,color:colors.muted},button:{height:56,borderRadius:radii.md,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:12,overflow:'hidden'},buttonDisabled:{opacity:.35},buttonText:{color:colors.white,fontSize:16,fontWeight:'900'},buttonArrow:{color:'#EFFFF8',fontSize:22,fontWeight:'900'},footer:{textAlign:'center',color:colors.muted,fontSize:12,marginTop:12}});