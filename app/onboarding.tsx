import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, radii } from '../lib/theme';

export default function Onboarding() {
  const { role } = useLocalSearchParams<{ role: 'professional' | 'company' }>();
  const [step, setStep] = useState(0);
  const [type, setType] = useState<'doctor' | 'nurse'>('doctor');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');

  const professional = role !== 'company';
  const title = professional ? ['Tell us about you.', 'What do you do?', 'Where can you operate?'][step] : ['Tell us about your company.', 'Where are you based?'][step];
  const total = professional ? 3 : 2;

  function next() {
    if (step < total - 1) setStep(step + 1);
    else router.replace('/home');
  }

  return <SafeAreaView style={styles.safe}><View style={styles.container}>
    <View><Text style={styles.progress}>{step + 1} / {total}</Text><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>You can complete the remaining verification details later.</Text></View>
    <View>
      {professional && step === 0 && <><Text style={styles.label}>Full name</Text><TextInput value={name} onChangeText={setName} placeholder="First and last name" placeholderTextColor="#9AA19F" style={styles.input}/></>}
      {professional && step === 1 && <View style={styles.choices}><Pressable onPress={()=>setType('doctor')} style={[styles.choice,type==='doctor'&&styles.active]}><Text style={styles.choiceTitle}>Doctor</Text><Text style={styles.choiceText}>Medical doctor</Text></Pressable><Pressable onPress={()=>setType('nurse')} style={[styles.choice,type==='nurse'&&styles.active]}><Text style={styles.choiceTitle}>Nurse</Text><Text style={styles.choiceText}>Registered nurse</Text></Pressable></View>}
      {((professional && step === 2) || (!professional && step === 0)) && <><Text style={styles.label}>{professional ? 'Starting location' : 'Company name'}</Text><TextInput value={professional ? location : name} onChangeText={professional ? setLocation : setName} placeholder={professional ? 'City, country' : 'Legal company name'} placeholderTextColor="#9AA19F" style={styles.input}/></>}
      {!professional && step === 1 && <><Text style={styles.label}>Headquarters</Text><TextInput value={location} onChangeText={setLocation} placeholder="City, country" placeholderTextColor="#9AA19F" style={styles.input}/></>}
      <Pressable style={styles.button} onPress={next}><Text style={styles.buttonText}>{step === total - 1 ? 'Finish setup' : 'Continue'}</Text></Pressable>
    </View>
    <Text style={styles.footer}>MediCrew verification protects the marketplace.</Text>
  </View></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},container:{flex:1,padding:24,justifyContent:'space-between'},progress:{fontSize:12,fontWeight:'800',color:colors.green,letterSpacing:1.2},title:{fontSize:38,lineHeight:42,fontWeight:'800',color:colors.ink,letterSpacing:-1.2,marginTop:12},subtitle:{fontSize:16,lineHeight:24,color:colors.muted,marginTop:12},label:{fontSize:13,fontWeight:'700',color:colors.ink,marginBottom:8},input:{height:54,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,backgroundColor:colors.white,paddingHorizontal:15,fontSize:16,color:colors.ink},choices:{gap:12},choice:{padding:18,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,backgroundColor:colors.white},active:{borderColor:colors.green,backgroundColor:colors.greenSoft},choiceTitle:{fontSize:17,fontWeight:'800',color:colors.ink},choiceText:{fontSize:13,color:colors.muted,marginTop:4},button:{height:56,borderRadius:radii.md,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center',marginTop:18},buttonText:{color:colors.white,fontSize:16,fontWeight:'800'},footer:{fontSize:12,color:colors.muted,textAlign:'center'}});
