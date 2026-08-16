import { useState } from 'react';
import { Alert, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, radii } from '../lib/theme';
import { supabase } from '../lib/supabase';

export default function Auth() {
  const { role } = useLocalSearchParams<{ role: 'professional' | 'company' }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signUp() {
    if (!supabase) return Alert.alert('Supabase not configured', 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your environment.');
    if (!email || !password) return Alert.alert('Missing information', 'Enter your email and password.');
    setLoading(true);
    const { error } = await supabase.auth.signUp({ email: email.trim(), password });
    setLoading(false);
    if (error) return Alert.alert('Sign up failed', error.message);
    router.replace({ pathname: '/onboarding', params: { role } });
  }

  return (
    <SafeAreaView style={styles.safe}><View style={styles.container}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
      <View>
        <Text style={styles.eyebrow}>CREATE YOUR ACCOUNT</Text>
        <Text style={styles.title}>{role === 'company' ? 'Set up your company.' : 'Join the professional network.'}</Text>
        <Text style={styles.subtitle}>Your account starts private. Verification comes before access to protected marketplace features.</Text>
      </View>
      <View>
        <Text style={styles.label}>Email</Text><TextInput autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} placeholder="you@company.com" placeholderTextColor="#9AA19F" style={styles.input}/>
        <Text style={styles.label}>Password</Text><TextInput secureTextEntry value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor="#9AA19F" style={styles.input}/>
        <Pressable disabled={loading} style={styles.button} onPress={signUp}><Text style={styles.buttonText}>{loading ? 'Creating…' : 'Create account'}</Text></Pressable>
      </View>
      <Text style={styles.note}>By continuing, you agree to MediCrew's terms and privacy policy.</Text>
    </View></SafeAreaView>
  );
}
const styles = StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},container:{flex:1,padding:24,justifyContent:'space-between'},back:{fontSize:16,fontWeight:'700',color:colors.ink},eyebrow:{fontSize:12,fontWeight:'800',letterSpacing:1.4,color:colors.green,marginBottom:12},title:{fontSize:38,lineHeight:42,fontWeight:'800',color:colors.ink,letterSpacing:-1.2},subtitle:{fontSize:16,lineHeight:24,color:colors.muted,marginTop:14},label:{fontSize:13,fontWeight:'700',color:colors.ink,marginBottom:7,marginTop:14},input:{height:52,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,backgroundColor:colors.white,paddingHorizontal:15,fontSize:16,color:colors.ink},button:{height:56,borderRadius:radii.md,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center',marginTop:20},buttonText:{color:colors.white,fontWeight:'800',fontSize:16},note:{fontSize:12,lineHeight:18,color:colors.muted,textAlign:'center'}});
