import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, radii } from '../lib/theme';
import { supabase } from '../lib/supabase';

export default function Auth() {
  const { role: requestedRole } = useLocalSearchParams<{ role?: 'professional' | 'company' }>();
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!supabase) return Alert.alert('Supabase not configured', 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment.');
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) return Alert.alert('Invalid email', 'Enter a valid email address.');
    if (password.length < 8) return Alert.alert('Password too short', 'Use at least 8 characters.');
    setLoading(true);

    if (mode === 'signup') {
      if (!requestedRole) { setLoading(false); return Alert.alert('Choose an account type', 'Go back and choose Professional or Company.'); }
      const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password, options: { data: { role: requestedRole } } });
      setLoading(false);
      if (error) return Alert.alert('Sign up failed', error.message);
      if (!data.session) return Alert.alert('Check your email', 'Your account was created. Confirm your email, then sign in to continue.');
      router.replace({ pathname: '/onboarding', params: { role: requestedRole } });
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    setLoading(false);
    if (error) return Alert.alert('Sign in failed', error.message);
    const role = data.user?.user_metadata?.role as 'professional' | 'company' | undefined;
    if (!role) return Alert.alert('Account setup incomplete', 'Your account does not have a valid MediCrew role.');
    router.replace(role === 'company' ? '/company' : '/home');
  }

  return <SafeAreaView style={styles.safe}><View style={styles.container}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
    <View><Text style={styles.eyebrow}>{mode === 'signup' ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</Text><Text style={styles.title}>{mode === 'signup' ? (requestedRole === 'company' ? 'Set up your company.' : 'Join the professional network.') : 'Sign in to MediCrew.'}</Text><Text style={styles.subtitle}>{mode === 'signup' ? 'Your account starts private. Verification comes before protected marketplace access.' : 'Access your missions, matches and professional network.'}</Text></View>
    <View><Text style={styles.label}>Email</Text><TextInput autoCapitalize="none" keyboardType="email-address" autoCorrect={false} value={email} onChangeText={setEmail} placeholder="you@company.com" placeholderTextColor="#9AA19F" style={styles.input}/><Text style={styles.label}>Password</Text><TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor="#9AA19F" style={styles.input}/><Pressable disabled={loading} style={[styles.button,loading&&{opacity:.6}]} onPress={submit}><Text style={styles.buttonText}>{loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</Text></Pressable><Pressable style={styles.switch} onPress={()=>setMode(mode==='signup'?'signin':'signup')}><Text style={styles.switchText}>{mode==='signup'?'Already have an account? Sign in':'New to MediCrew? Create an account'}</Text></Pressable></View>
    <Text style={styles.note}>MediCrew verification protects the marketplace.</Text>
  </View></SafeAreaView>;
}
const styles=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},container:{flex:1,padding:24,justifyContent:'space-between'},back:{fontSize:16,fontWeight:'700',color:colors.ink},eyebrow:{fontSize:12,fontWeight:'800',letterSpacing:1.4,color:colors.green,marginBottom:12},title:{fontSize:38,lineHeight:42,fontWeight:'800',color:colors.ink,letterSpacing:-1.2},subtitle:{fontSize:16,lineHeight:24,color:colors.muted,marginTop:14},label:{fontSize:13,fontWeight:'700',color:colors.ink,marginBottom:7,marginTop:14},input:{height:52,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,backgroundColor:colors.white,paddingHorizontal:15,fontSize:16,color:colors.ink},button:{height:56,borderRadius:radii.md,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center',marginTop:20},buttonText:{color:colors.white,fontWeight:'800',fontSize:16},switch:{alignItems:'center',paddingVertical:15},switchText:{color:colors.green,fontWeight:'700',fontSize:13},note:{fontSize:12,lineHeight:18,color:colors.muted,textAlign:'center'}});
