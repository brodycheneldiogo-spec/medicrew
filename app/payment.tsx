import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { StripeProvider, CardField, useStripe } from '@stripe/stripe-react-native';
import { supabase } from '../lib/supabase';
import { colors, radii } from '../lib/theme';

function PaymentForm({ missionId }: { missionId: string }) {
  const { confirmPayment } = useStripe();
  const [clientSecret, setClientSecret] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState(0);
  const [fee, setFee] = useState(0);
  const [professionalAmount, setProfessionalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!supabase) { setError('Database unavailable'); setLoading(false); return; }
      const { data, error: invokeError } = await supabase.functions.invoke('create-payment-intent', { body: { missionId } });
      if (invokeError) setError(invokeError.message);
      else if (data?.error) setError(data.error);
      else {
        setClientSecret(data.clientSecret); setPaymentId(data.paymentId); setAmount(data.amountCents || 0);
        setFee(data.platformFeeCents || 0); setProfessionalAmount(data.professionalAmountCents || 0);
      }
      setLoading(false);
    })();
  }, [missionId]);

  const pay = async () => {
    if (!clientSecret) return;
    setPaying(true); setError('');
    const { error: paymentError, paymentIntent } = await confirmPayment(clientSecret, {
      paymentMethodType: 'Card',
    });
    if (paymentError) { setError(paymentError.message || 'Payment failed'); setPaying(false); return; }
    if (paymentIntent?.status === 'Succeeded') {
      const { data, error: syncError } = await supabase!.functions.invoke('sync-payment-status', { body: { paymentId } });
      if (syncError || data?.status !== 'paid') { setError('Payment was accepted but is still being confirmed. Please wait a moment before starting the mission.'); }
      else setComplete(true);
    }
    setPaying(false);
  };

  if (loading) return <ActivityIndicator size="large" color={colors.green} style={{ marginTop: 70 }} />;
  if (complete) return <View style={s.success}><View style={s.successIcon}><Text style={s.tick}>✓</Text></View><Text style={s.successTitle}>Payment confirmed</Text><Text style={s.successText}>The mission is paid through MediCrew. The professional receives 95% after both sides confirm completion.</Text><Pressable style={s.primary} onPress={() => router.replace({ pathname:'/mission-confirmed', params:{ missionId } })}><Text style={s.primaryText}>Back to mission</Text></Pressable></View>;

  return <>
    {error ? <View style={s.error}><Text style={s.errorText}>{error}</Text></View> : null}
    <View style={s.card}><Text style={s.cardLabel}>MISSION PAYMENT</Text><Text style={s.amount}>€{(amount / 100).toFixed(2)}</Text><View style={s.line}/><Row label="Professional receives" value={`€${(professionalAmount / 100).toFixed(2)}`}/><Row label="MediCrew service fee (5%)" value={`€${(fee / 100).toFixed(2)}`}/><Row label="Payment processing" value="Included in MediCrew processing"/></View>
    <Text style={s.section}>Card details</Text>
    <CardField postalCodeEnabled={false} placeholders={{ number:'1234 1234 1234 1234' }} style={s.cardField} cardStyle={{ backgroundColor:'#FFFFFF', textColor:colors.ink, borderColor:'#E5E8E5', borderWidth:1, borderRadius:12 }} />
    <View style={s.notice}><Text style={s.noticeTitle}>Protected marketplace payment</Text><Text style={s.noticeText}>Your payment is processed by MediCrew. We keep the 5% service fee and transfer the remaining 95% to the verified professional after the mission is completed and both sides confirm completion.</Text></View>
    <Pressable disabled={paying} style={[s.primary,paying&&{opacity:.6}]} onPress={pay}><Text style={s.primaryText}>{paying?'Processing…':`Pay €${(amount/100).toFixed(2)}`}</Text></Pressable>
  </>;
}

export default function Payment() {
  const { missionId } = useLocalSearchParams<{ missionId:string }>();
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
  if (!missionId) return <SafeAreaView style={s.safe}><Text style={s.errorText}>Mission not found.</Text></SafeAreaView>;
  return <StripeProvider publishableKey={publishableKey}><SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled"><Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Back</Text></Pressable><Text style={s.eyebrow}>SECURE PAYMENT</Text><Text style={s.title}>Pay the mission.</Text><Text style={s.sub}>The company pays MediCrew before the mission starts. The professional is paid after both sides confirm completion.</Text><PaymentForm missionId={missionId}/></ScrollView></SafeAreaView></StripeProvider>;
}
function Row({label,value}:{label:string;value:string}){return <View style={s.row}><Text style={s.label}>{label}</Text><Text style={s.value}>{value}</Text></View>}
const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},container:{padding:22,paddingBottom:50},back:{fontSize:15,fontWeight:'800',color:colors.ink,marginBottom:24},eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.5,color:colors.green},title:{fontSize:34,fontWeight:'900',color:colors.ink,marginTop:7},sub:{fontSize:13,lineHeight:20,color:colors.muted,marginTop:7,marginBottom:20},card:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:radii.lg,padding:18},cardLabel:{fontSize:9,fontWeight:'900',letterSpacing:1.2,color:colors.green},amount:{fontSize:34,fontWeight:'900',color:colors.ink,marginTop:6},line:{height:1,backgroundColor:colors.line,marginVertical:14},row:{flexDirection:'row',justifyContent:'space-between',paddingVertical:7},label:{fontSize:12,color:colors.muted},value:{fontSize:12,fontWeight:'800',color:colors.ink},section:{fontSize:17,fontWeight:'900',color:colors.ink,marginTop:22,marginBottom:9},cardField:{width:'100%',height:54},notice:{backgroundColor:colors.greenSoft,borderRadius:14,padding:14,marginVertical:16},noticeTitle:{fontSize:12,fontWeight:'900',color:'#117A5B'},noticeText:{fontSize:11,lineHeight:17,color:'#3C6659',marginTop:4},primary:{minHeight:55,borderRadius:15,backgroundColor:colors.ink,alignItems:'center',justifyContent:'center'},primaryText:{color:colors.white,fontSize:15,fontWeight:'900'},error:{backgroundColor:'#FDECEC',borderRadius:12,padding:12,marginBottom:12},errorText:{color:'#A23A3A',fontSize:12},success:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:20,padding:24,alignItems:'center',marginTop:20},successIcon:{width:58,height:58,borderRadius:29,backgroundColor:colors.greenSoft,alignItems:'center',justifyContent:'center'},tick:{fontSize:30,fontWeight:'900',color:colors.green},successTitle:{fontSize:23,fontWeight:'900',color:colors.ink,marginTop:14},successText:{fontSize:13,lineHeight:20,color:colors.muted,textAlign:'center',marginTop:7,marginBottom:18}});
