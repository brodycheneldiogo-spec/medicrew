import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { colors, radii } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { usePreferences } from '../lib/preferences-context';
import { localize } from '../lib/i18n';

type VerificationFlow='signup'|'google';
const OTP_LENGTH=8;

export default function VerifyEmail(){
 const prefs=usePreferences();
 const L=(en:string,fr:string,es:string)=>localize(prefs.language,en,fr,es);
 const{returnTo,email:emailParam,flow:flowParam}=useLocalSearchParams<{returnTo?:string;email?:string;flow?:VerificationFlow}>();
 const[email,setEmail]=useState(typeof emailParam==='string'?emailParam:'');
 const[code,setCode]=useState('');
 const[loading,setLoading]=useState(true);
 const[sending,setSending]=useState(false);
 const[checking,setChecking]=useState(false);
 const[cooldown,setCooldown]=useState(60);
 const input=useRef<TextInput>(null);
 const destination=(typeof returnTo==='string'&&returnTo?returnTo:'/home') as Href;
 const flow:VerificationFlow=flowParam==='google'?'google':'signup';

 useEffect(()=>{let active=true;(async()=>{if(!supabase){setLoading(false);return}const{data:{user}}=await supabase.auth.getUser();if(!active)return;if(user?.email&&!email)setEmail(user.email);if(flow==='signup'&&user?.email_confirmed_at)router.replace(destination);setLoading(false);setTimeout(()=>input.current?.focus(),200)})();return()=>{active=false}},[destination,email,flow]);
 useEffect(()=>{if(cooldown<=0)return;const timer=setTimeout(()=>setCooldown(v=>Math.max(0,v-1)),1000);return()=>clearTimeout(timer)},[cooldown]);

 function updateCode(raw:string){
   if(raw && !/^\d{0,8}$/.test(raw)){
     setCode('');
     Alert.alert(
       L('Enter the 8-digit code','Entrez le code à 8 chiffres','Introduce el código de 8 dígitos'),
       L('Paste only the 8 digits shown in the MediCrew email, not a link.','Collez uniquement les 8 chiffres affichés dans l’email MediCrew, pas un lien.','Pega solo los 8 dígitos del email de MediCrew, no un enlace.')
     );
     return;
   }
   setCode(raw.slice(0,OTP_LENGTH));
 }

 async function resend(){
   if(!supabase||!email||sending||cooldown>0)return;
   setSending(true);
   const {error}=flow==='signup'
     ? await supabase.auth.resend({type:'signup',email})
     : await supabase.auth.signInWithOtp({email,options:{shouldCreateUser:false}});
   setSending(false);
   if(error)return Alert.alert(L('Could not send code','Impossible d’envoyer le code','No se pudo enviar el código'),error.message);
   setCode('');setCooldown(60);setTimeout(()=>input.current?.focus(),150);
   Alert.alert(
     L('New code sent','Nouveau code envoyé','Nuevo código enviado'),
     L('Check your inbox and spam folder. Only the newest 8-digit code will work.','Vérifiez votre boîte de réception et les spams. Seul le dernier code à 8 chiffres fonctionnera.','Revisa tu bandeja de entrada y spam. Solo funcionará el código de 8 dígitos más reciente.')
   );
 }

 async function verify(){
   if(!supabase||checking)return;
   if(!/^\d{8}$/.test(code))return Alert.alert(L('Enter the 8-digit code','Entrez le code à 8 chiffres','Introduce el código de 8 dígitos'));
   setChecking(true);
   const {error}=await supabase.auth.verifyOtp({email,token:code,type:'email'});
   setChecking(false);
   if(error)return Alert.alert(
     L('Invalid code','Code invalide','Código inválido'),
     L('Use the newest 8-digit code from the MediCrew email.','Utilisez le dernier code à 8 chiffres reçu par email MediCrew.','Usa el código de 8 dígitos más reciente del email de MediCrew.')
   );
   router.replace(destination);
 }

 if(loading)return <SafeAreaView style={s.safe}><ActivityIndicator color={colors.green} style={{marginTop:60}}/></SafeAreaView>;
 return <SafeAreaView style={s.safe}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS==='ios'?'padding':undefined}><View style={s.container}>
   <View style={s.icon}><Text style={s.iconText}>✉</Text></View>
   <Text style={s.eyebrow}>{L('EMAIL VERIFICATION','VÉRIFICATION EMAIL','VERIFICACIÓN DE EMAIL')}</Text>
   <Text style={s.title}>{L('Enter your code.','Entrez votre code.','Introduce tu código.')}</Text>
   <Text style={s.sub}>{L('We sent an 8-digit MediCrew verification code to','Nous avons envoyé un code MediCrew à 8 chiffres à','Hemos enviado un código MediCrew de 8 dígitos a')} <Text style={s.bold}>{email}</Text>.</Text>
   <Pressable onPress={()=>input.current?.focus()} style={s.codeWrap}><TextInput ref={input} value={code} onChangeText={updateCode} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={OTP_LENGTH} style={s.codeInput}/></Pressable>
   <Text style={s.hint}>{L('Enter only the 8 digits from the email.','Entrez uniquement les 8 chiffres de l’email.','Introduce solo los 8 dígitos del email.')}</Text>
   <Pressable disabled={checking||code.length!==OTP_LENGTH} onPress={verify} style={[s.primary,(checking||code.length!==OTP_LENGTH)&&s.disabled]}><Text style={s.primaryText}>{checking?L('Verifying…','Vérification…','Verificando…'):L('Verify email','Vérifier l’email','Verificar email')}</Text><Text style={s.arrow}>→</Text></Pressable>
   <View style={s.card}><Text style={s.cardTitle}>{L('Didn’t receive it?','Vous ne l’avez pas reçu ?','¿No lo has recibido?')}</Text><Text style={s.cardText}>{cooldown>0?L(`You can request a new code in ${cooldown}s.`,`Vous pourrez demander un nouveau code dans ${cooldown}s.`,`Podrás solicitar un nuevo código en ${cooldown}s.`):L('You can request a new verification code now.','Vous pouvez maintenant demander un nouveau code.','Ya puedes solicitar un nuevo código.')}</Text><Pressable disabled={sending||!email||cooldown>0} onPress={resend} style={[s.secondary,(sending||!email||cooldown>0)&&s.secondaryDisabled]}><Text style={s.secondaryText}>{sending?L('Sending…','Envoi…','Enviando…'):cooldown>0?L(`Resend in ${cooldown}s`,`Renvoyer dans ${cooldown}s`,`Reenviar en ${cooldown}s`):L('Send a new code','Envoyer un nouveau code','Enviar un código nuevo')}</Text></Pressable></View>
   <Pressable onPress={()=>supabase?.auth.signOut().then(()=>router.replace('/'))} style={s.link}><Text style={s.linkText}>{L('Use another account','Utiliser un autre compte','Usar otra cuenta')}</Text></Pressable>
 </View></KeyboardAvoidingView></SafeAreaView>
}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},flex:{flex:1},container:{flex:1,padding:24,justifyContent:'center'},icon:{width:70,height:70,borderRadius:35,backgroundColor:colors.greenSoft,alignItems:'center',justifyContent:'center',alignSelf:'center',marginBottom:20},iconText:{fontSize:30,color:colors.greenDark},eyebrow:{fontSize:11,fontWeight:'900',letterSpacing:1.5,color:colors.green,textAlign:'center'},title:{fontSize:34,lineHeight:39,fontWeight:'900',color:colors.ink,textAlign:'center',marginTop:8},sub:{fontSize:14,lineHeight:21,color:colors.muted,textAlign:'center',marginTop:10},bold:{fontWeight:'800',color:colors.ink},codeWrap:{alignSelf:'center',marginTop:28,borderWidth:1.5,borderColor:colors.green,borderRadius:radii.lg,backgroundColor:colors.white,paddingHorizontal:16,paddingVertical:10},codeInput:{minWidth:250,textAlign:'center',fontSize:30,fontWeight:'900',letterSpacing:9,color:colors.ink,paddingLeft:9},hint:{fontSize:11,lineHeight:17,color:colors.muted,textAlign:'center',marginTop:10},card:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:radii.lg,padding:18,marginTop:18},cardTitle:{fontSize:16,fontWeight:'800',color:colors.ink},cardText:{fontSize:12,lineHeight:18,color:colors.muted,marginTop:4},secondary:{marginTop:13,height:44,borderWidth:1,borderColor:colors.line,borderRadius:radii.md,alignItems:'center',justifyContent:'center'},secondaryDisabled:{opacity:.45},secondaryText:{fontSize:12,fontWeight:'800',color:colors.greenDark},primary:{height:55,borderRadius:radii.md,backgroundColor:colors.ink,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,marginTop:18},disabled:{opacity:.4},primaryText:{color:colors.white,fontSize:15,fontWeight:'900'},arrow:{color:colors.green,fontSize:21},link:{alignItems:'center',padding:16},linkText:{color:colors.muted,fontWeight:'700',fontSize:12}});