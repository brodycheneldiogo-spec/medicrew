import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, radii } from '../lib/theme';
import { supabase } from '../lib/supabase';

function normalizePhone(value: string) { return value.replace(/[\s()-]/g, ''); }

export default function Auth() {
  const { role: requestedRole } = useLocalSearchParams<{ role?: 'professional' | 'company' }>();
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function sendCode() {
    if (!supabase) return Alert.alert('Supabase not configured', 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment.');
    const cleanPhone = normalizePhone(phone.trim());
    if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) return Alert.alert('Invalid phone number', 'Use international format, for example +33 6 12 34 56 78.');
    if (mode === 'signup' && !requestedRole) return Alert.alert('Choose an account type', 'Go back and choose Professional or Company.');
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: cleanPhone, options: mode === 'signup' ? { data: { role: requestedRole } } : undefined });
    setLoading(false);
    if (error) return Alert.alert('Code could not be sent', error.message);
    setOtpSent(true);
  }

  async function verifyCode() {
    if (!supabase) return;
    const cleanPhone = normalizePhone(phone.trim());
    if (!/^\d{4,8}$/.test(code.trim())) return Alert.alert('Invalid code', 'Enter the verification code you received.');
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({ phone: cleanPhone, token: code.trim(), type: 'sms' });
    setLoading(false);
    if (error) return Alert.alert('Verification failed', error.message);
    const role = (data.user?.user_metadata?.role || requestedRole) as 'professional' | 'company' | undefined;
    if (!role) return Alert.alert('Account setup incomplete', 'Your account does not have a valid MediCrew role.');
    router.replace(role === 'company' ? '/company' : '/home');
  }

  return <SafeAreaView style={styles.safe}><View style={styles.container}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
    <View><Text style={styles.eyebrow}>{mode === 'signup' ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</Text><Text style={styles.title}>{mode === 'signup' ? (requestedRole === 'company' ? 'Set up your company.' : 'Join the professional network.') : 'Sign in to MediCrew.'}</Text><Text style={styles.subtitle}>{mode === 'signup' ? 'Use your mobile number. Verification keeps the MediCrew network trusted.' : 'Verify your mobile number to access your missions, matches and network.'}</Text></View>
    <View>
      <Text style={styles.label}>Mobile number</Text>
      <TextInput autoCapitalize="none" keyboardType="phone-pad" autoCorrect={false} value={phone} onChangeText={setPhone} placeholder="+33 6 12 34 56 78" placeholderTextColor="#9AA19F" style={styles.input} editable={!otpSent}/>
      {otpSent ? <><Text style={styles.label}>Verification code</Text><TextInput keyboardType="number-pad" autoFocus value={code} onChangeText={setCode} placeholder="123456" placeholderTextColor="#9AA19F" style={styles.input} maxLength={8}/><Pressable disabled={loading} style={[styles.button,loading&&{opacity:.6}]} onPress={verifyCode}><Text style={styles.buttonText}>{loading ? 'Verifying…' : 'Verify & continue'}</Text></Pressable><Pressable disabled={loading} style={styles.switch} onPress={()=>{setOtpSent(false);setCode('')}}><Text style={styles.switchText}>Change phone number</Text></Pressable></> : <Pressable disabled={loading} style={[styles.button,loading&&{opacity:.6}]} onPress={sendCode}><Text style={styles.buttonText}>{loading ? 'Sending code…' : 'Send verification code'}</Text></Pressable>}
      {!otpSent&&<Pressable style={styles.switch} onPress={()=>{setMode(mode==='signup'?'signin':'signup');setCode('');setOtpSent(false)}}><Text style={styles.switchText}>{mode==='signup'?'Already have an account? Sign in with phone':'New to MediCrew? Create an account'}</Text></Pressable>}
    </View>
    <Text style={styles.note}>SMS verification is required. Your phone number is used for authentication and operational contact.</Text>
  </View></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},container:{flex:1,padding:24,justifyContent:'space-between'},back:{fontSize:16,fontWeight:'700',color:colors.ink},eyebrow:{fontSize:12,fontWeight:'800',letterSpacing:1.4,color:colors.green,marginBottom:12},title:{fontSize:38,lineHeight:42,fontWeight:'800',color:colors.ink,letterSpacing:-1.2},subtitle:{fontSize:16,lineHeight:24,color:colors.muted,marginTop:14},label:{fontSize:13,fontWeight:'700',color:colors.ink,marginBottom:7,marginTop:14},input:{height:52,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,backgroundColor:colors.white,paddingHorizontal:15,fontSize:16,color:colors.ink},button:{height:56,borderRadius:radii.md,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center',marginTop:20},buttonText:{color:colors.white,fontWeight:'800',fontSize:16},switch:{alignItems:'center',paddingVertical:15},switchText:{color:colors.green,fontWeight:'700',fontSize:13},note:{fontSize:12,lineHeight:18,color:colors.muted,textAlign:'center'}});