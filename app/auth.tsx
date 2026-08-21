import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { FontAwesome } from '@expo/vector-icons';
import { colors, radii } from '../lib/theme';
import { MediCrewLogo } from '../lib/brand';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const DEV_TEST_EMAIL = 'brodycheneldiogo@gmail.com';
const DEV_TEST_PHONE = '+33759400771';

const normalizePhone = (value: string) => {
  const compact = value.replace(/[\s().-]/g, '');
  if (/^0\d{9}$/.test(compact)) return `+33${compact.slice(1)}`;
  return compact;
};
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const strong = (value: string) => value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value);
const isDevTestPhone = (value: string) => __DEV__ && normalizePhone(value) === DEV_TEST_PHONE;
const isDevTestEmail = (value: string | null | undefined) => __DEV__ && (value || '').trim().toLowerCase() === DEV_TEST_EMAIL;

function configuredClient() {
  if (supabase) return supabase;
  Alert.alert('Supabase not configured', 'The app is running, but its public Supabase URL/key are missing from the Expo environment. Configure them on this Mac, then restart Expo.');
  return null;
}

export default function Auth() {
  const { role: requestedRole } = useLocalSearchParams<{ role?: 'professional' | 'company' }>();
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const sub = client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await client.from('profiles').update({ email: session.user.email || null }).eq('id', session.user.id);
      }
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  async function sendCode() {
    if (!requestedRole) return Alert.alert('Choose an account type', 'Choose Professional or Company first.');
    if (isDevTestPhone(phone)) {
      setOtpSent(false);
      setStep(2);
      setEmail(DEV_TEST_EMAIL);
      return Alert.alert('Development test account', 'SMS verification is skipped for this approved test number. Continue with Google using the approved test email.');
    }
    const client = configuredClient();
    if (!client) return;
    const normalized = normalizePhone(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) return Alert.alert('Invalid phone number', 'Use international format, for example +33 6 12 34 56 78.');
    setLoading(true);
    const { error } = await client.auth.signInWithOtp({ phone: normalized, options: { data: { role: requestedRole, signup_stage: 'phone_verified' } } });
    setLoading(false);
    if (error) return Alert.alert('Code could not be sent', error.message);
    setOtpSent(true);
  }

  async function verifyPhone() {
    const client = configuredClient();
    if (!client) return;
    setLoading(true);
    const { data, error } = await client.auth.verifyOtp({ phone: normalizePhone(phone), token: code.trim(), type: 'sms' });
    setLoading(false);
    if (error) return Alert.alert('Verification failed', error.message);
    if (!data.user?.id) return Alert.alert('Account setup incomplete');
    setStep(2);
  }

  async function finishSignup() {
    const client = configuredClient();
    if (!client || !requestedRole) return;
    const em = email.trim().toLowerCase();
    if (!validEmail(em)) return Alert.alert('Email required', 'Enter a valid email address.');
    if (!strong(password)) return Alert.alert('Password too weak', 'Use at least 8 characters with uppercase, lowercase and a number.');
    if (!accepted) return Alert.alert('Legal acceptance required', 'Accept the current Terms, Privacy Policy and Data Policy.');
    if (isDevTestPhone(phone) && isDevTestEmail(em)) return Alert.alert('Test account', 'For this development account, use Continue with Google. SMS and MediCrew email verification are skipped.');
    setLoading(true);
    const { data, error } = await client.auth.updateUser({ email: em, password, data: { role: requestedRole, signup_complete: true } });
    if (error) { setLoading(false); return Alert.alert('Could not finish account', error.message); }
    const id = data.user?.id;
    if (!id) { setLoading(false); return Alert.alert('Account setup incomplete'); }
    const profile = await client.from('profiles').update({ email: em, phone: normalizePhone(phone) }).eq('id', id);
    if (profile.error) { setLoading(false); return Alert.alert('Could not save account details', profile.error.message); }
    await client.from('legal_acceptances').insert({ profile_id: id, terms_version: '2.1', privacy_version: '1.2', data_policy_version: '1.1' });
    setLoading(false);
    router.replace({ pathname: '/verify-email', params: { returnTo: requestedRole === 'company' ? '/onboarding?role=company' : '/onboarding?role=professional' } });
  }

  async function emailSignIn() {
    const client = configuredClient();
    if (!client) return;
    const em = email.trim().toLowerCase();
    if (!validEmail(em) || !password) return Alert.alert('Email and password required');
    setLoading(true);
    const { data, error } = await client.auth.signInWithPassword({ email: em, password });
    setLoading(false);
    if (error) return Alert.alert('Sign in failed', error.message || 'Email or password is incorrect.');
    const { data: profile } = await client.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    const role = profile?.role || data.user.user_metadata?.role;
    if (!data.user.email_confirmed_at && !isDevTestEmail(data.user.email)) return router.replace({ pathname: '/verify-email', params: { returnTo: role === 'company' ? '/company' : role === 'admin' ? '/admin' : '/home' } });
    const legal = await client.rpc('has_current_legal_acceptance', { p_profile_id: data.user.id });
    if (!legal.error && !legal.data) return router.replace({ pathname: '/legal-consent', params: { returnTo: role === 'company' ? '/company' : role === 'admin' ? '/admin' : '/home' } });
    router.replace(role === 'company' ? '/company' : role === 'admin' ? '/admin' : '/home');
  }

  async function completeGoogleSession(resultUrl: string, role: 'professional' | 'company', devBypass: boolean) {
    const client = configuredClient();
    if (!client) return;
    const parsed = Linking.parse(resultUrl);
    const codeParam = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
    if (!codeParam) throw new Error('Google did not return an authorization code.');
    const exchange = await client.auth.exchangeCodeForSession(codeParam);
    if (exchange.error) throw exchange.error;
    if (devBypass && !isDevTestEmail(exchange.data.user.email)) {
      await client.auth.signOut();
      throw new Error('This development bypass is restricted to the approved test Google account.');
    }
    await client.auth.updateUser({ data: { role, signup_complete: true, dev_test_bypass: devBypass || undefined } });
    await client.from('profiles').update({ email: exchange.data.user.email || null, phone: devBypass ? DEV_TEST_PHONE : normalizePhone(phone) }).eq('id', exchange.data.user.id);
    await client.from('legal_acceptances').insert({ profile_id: exchange.data.user.id, terms_version: '2.1', privacy_version: '1.2', data_policy_version: '1.1' });
    router.replace(role === 'company' ? '/onboarding?role=company' : '/onboarding?role=professional');
  }

  async function google() {
    const client = configuredClient();
    if (!client) return;
    setGoogleBusy(true);
    try {
      const redirectTo = Linking.createURL('auth/callback');
      if (mode === 'signup') {
        if (step !== 2) return Alert.alert('Phone verification required', 'Verify your phone first.');
        if (!requestedRole || !accepted) return Alert.alert('Legal acceptance required', 'Verify your phone and accept the terms first.');
        const devBypass = isDevTestPhone(phone);
        if (devBypass) {
          const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } });
          if (error || !data?.url) throw error || new Error('Could not start Google test sign-up');
          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
          if (result.type === 'success') await completeGoogleSession(result.url, requestedRole, true);
          return;
        }
        const { data: current } = await client.auth.getUser();
        if (!current.user) throw new Error('Phone verification required');
        const { data, error } = await client.auth.linkIdentity({ provider: 'google', options: { redirectTo, queryParams: { prompt: 'select_account' } } });
        if (error || !data?.url) throw error || new Error('Could not start Google sign-up');
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success') await completeGoogleSession(result.url, requestedRole, false);
      } else {
        const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } } });
        if (error || !data?.url) throw error || new Error('Could not start Google sign-in');
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success') {
          const parsed = Linking.parse(result.url);
          const codeParam = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : null;
          if (!codeParam) throw new Error('Google did not return an authorization code.');
          const exchange = await client.auth.exchangeCodeForSession(codeParam);
          if (exchange.error) throw exchange.error;
          const { data: profile } = await client.from('profiles').select('role').eq('id', exchange.data.user.id).maybeSingle();
          router.replace(profile?.role === 'company' ? '/company' : profile?.role === 'admin' ? '/admin' : '/home');
        }
      }
    } catch (error: any) {
      Alert.alert('Google authentication failed', error?.message || 'Please try again.');
    } finally {
      setGoogleBusy(false);
    }
  }

  const devBypassActive = mode === 'signup' && step === 2 && isDevTestPhone(phone);
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => step === 2 && mode === 'signup' ? (setStep(1), setPassword('')) : router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
          <MediCrewLogo />
          <Text style={s.progress}>{mode === 'signup' ? `${step} / 2` : 'SECURE SIGN IN'}</Text>
          <Text style={s.eyebrow}>{mode === 'signup' ? (step === 1 ? 'PHONE VERIFICATION' : 'ACCOUNT SECURITY') : 'WELCOME BACK'}</Text>
          <Text style={s.title}>{mode === 'signup' ? (step === 1 ? 'Verify your phone.' : 'Finish your account.') : 'Sign in to MediCrew.'}</Text>
          <Text style={s.sub}>{mode === 'signup' ? 'New accounts verify a phone first, then use email/password or Google.' : 'Use email/password or Google. Your phone number is not a sign-in credential.'}</Text>
          <View style={s.form}>
            {mode === 'signin' ? <>
              <Field label="Email address" value={email} onChange={setEmail} keyboard="email-address" />
              <Text style={s.label}>Password</Text><Password value={password} onChange={setPassword} show={show} setShow={setShow} />
              <Pressable disabled={loading} onPress={emailSignIn}><LinearGradient colors={[colors.greenStart, colors.green, colors.greenEnd]} style={s.button}><Text style={s.buttonText}>{loading ? 'Signing in…' : 'Sign in'}</Text></LinearGradient></Pressable>
              <GoogleButton busy={googleBusy} onPress={google} />
              <Pressable style={s.switch} onPress={() => router.push('/forgot-password')}><Text style={s.switchText}>Forgot your password?</Text></Pressable>
            </> : step === 1 ? <>
              <Field label="Mobile number" value={phone} onChange={setPhone} keyboard="phone-pad" editable={!otpSent} />
              {otpSent ? <><Field label="Verification code" value={code} onChange={setCode} keyboard="number-pad" /><Pressable disabled={loading} onPress={verifyPhone}><LinearGradient colors={[colors.greenStart, colors.green, colors.greenEnd]} style={s.button}><Text style={s.buttonText}>{loading ? 'Verifying…' : 'Verify phone & continue'}</Text></LinearGradient></Pressable></> : <Pressable disabled={loading} onPress={sendCode}><LinearGradient colors={[colors.greenStart, colors.green, colors.greenEnd]} style={s.button}><Text style={s.buttonText}>{loading ? 'Sending code…' : isDevTestPhone(phone) ? 'Continue with test number' : 'Send verification code'}</Text></LinearGradient></Pressable>}
              <Pressable style={s.switch} onPress={() => setMode('signin')}><Text style={s.switchText}>Already have an account? Sign in with email</Text></Pressable>
            </> : <>
              <View style={s.badge}><Text style={s.badgeText}>{devBypassActive ? '✓ DEVELOPMENT TEST NUMBER' : '✓ PHONE VERIFIED'}</Text></View>
              <Field label="Email address" value={email} onChange={setEmail} keyboard="email-address" editable={!devBypassActive} />
              {!devBypassActive ? <><Text style={s.label}>Password</Text><Password value={password} onChange={setPassword} show={show} setShow={setShow} /><Text style={s.rules}>{strong(password) ? '✓ Strong password' : 'Use 8+ characters, uppercase, lowercase and a number.'}</Text></> : <Text style={s.rules}>Development test account: continue with the approved Google account.</Text>}
              <Pressable style={s.legal} onPress={() => setAccepted(v => !v)}><Text style={s.check}>{accepted ? '✓' : '○'}</Text><Text style={s.legalText}>I accept the current <Text style={s.link} onPress={() => router.push('/terms')}>Terms</Text>, <Text style={s.link} onPress={() => router.push('/privacy')}>Privacy</Text> and <Text style={s.link} onPress={() => router.push('/data-policy')}>Data Policy</Text>.</Text></Pressable>
              {!devBypassActive && <Pressable disabled={loading} onPress={finishSignup}><LinearGradient colors={[colors.greenStart, colors.green, colors.greenEnd]} style={s.button}><Text style={s.buttonText}>{loading ? 'Creating account…' : 'Create with email & password'}</Text></LinearGradient></Pressable>}
              <GoogleButton busy={googleBusy} onPress={google} />
            </>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function GoogleButton({ busy, onPress }: { busy: boolean; onPress: () => void }) {
  return <Pressable disabled={busy} onPress={onPress} style={s.google}><FontAwesome name="google" size={18} color="#4285F4" /><Text style={s.googleText}>{busy ? 'Opening Google…' : 'Continue with Google'}</Text></Pressable>;
}
function Field({label,value,onChange,keyboard,editable=true}:{label:string;value:string;onChange:(v:string)=>void;keyboard?:any;editable?:boolean}) { return <><Text style={s.label}>{label}</Text><TextInput autoCapitalize="none" autoCorrect={false} keyboardType={keyboard} editable={editable} value={value} onChangeText={onChange} placeholder={label} placeholderTextColor="#9AA19F" style={s.input}/></>; }
function Password({value,onChange,show,setShow}:{value:string;onChange:(v:string)=>void;show:boolean;setShow:(v:boolean)=>void}) { return <View style={s.password}><TextInput autoCapitalize="none" secureTextEntry={!show} value={value} onChangeText={onChange} placeholder="Password" placeholderTextColor="#9AA19F" style={s.passwordInput}/><Pressable onPress={()=>setShow(!show)}><Text style={s.eye}>👁️</Text></Pressable></View>; }

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.paper},flex:{flex:1},container:{padding:24,paddingBottom:50,gap:14},back:{fontSize:16,fontWeight:'800',color:colors.ink},progress:{fontSize:10,fontWeight:'900',letterSpacing:1.3,color:colors.muted},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.5,color:colors.green},title:{fontSize:34,lineHeight:38,fontWeight:'900',color:colors.ink,letterSpacing:-1},sub:{fontSize:14,lineHeight:21,color:colors.muted},form:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:radii.lg,padding:18},label:{fontSize:12,fontWeight:'800',color:colors.ink,marginTop:10,marginBottom:7},input:{height:52,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,backgroundColor:colors.paper,paddingHorizontal:14,fontSize:16,color:colors.ink},password:{height:52,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,backgroundColor:colors.paper,flexDirection:'row',alignItems:'center',paddingRight:12},passwordInput:{flex:1,height:50,paddingHorizontal:14,fontSize:16,color:colors.ink},eye:{fontSize:19},button:{height:55,borderRadius:radii.md,alignItems:'center',justifyContent:'center',marginTop:17},buttonText:{color:colors.white,fontWeight:'900',fontSize:15},google:{height:55,borderRadius:radii.md,borderWidth:1,borderColor:colors.line,alignItems:'center',justifyContent:'center',marginTop:9,flexDirection:'row',gap:10,backgroundColor:colors.white},googleText:{fontWeight:'900',color:colors.ink},switch:{alignItems:'center',paddingVertical:11},switchText:{fontSize:12,fontWeight:'800',color:colors.greenDark},badge:{alignSelf:'flex-start',backgroundColor:colors.greenSoft,borderRadius:radii.pill,padding:9},badgeText:{fontSize:10,fontWeight:'900',color:colors.greenDark},rules:{fontSize:11,color:colors.muted,marginTop:6},legal:{flexDirection:'row',alignItems:'flex-start',marginTop:10},check:{fontSize:22,color:colors.greenDark,width:28},legalText:{flex:1,fontSize:11,lineHeight:17,color:colors.muted},link:{fontWeight:'900',color:colors.greenDark}
});
