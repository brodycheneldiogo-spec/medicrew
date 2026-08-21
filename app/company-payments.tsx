import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

type Invoice={id:string;mission_id:string;status:string;amount_cents:number;hosted_invoice_url?:string|null;created_at:string;due_at?:string|null};
type CompletedMission={id:string;title:string;service_fee_cents:number;compensation_cents:number;completed_at?:string|null;updated_at:string};

export default function CompanyPayments(){
 const[invoices,setInvoices]=useState<Invoice[]>([]);
 const[pendingMissions,setPendingMissions]=useState<CompletedMission[]>([]);
 const[loading,setLoading]=useState(true);
 const[creating,setCreating]=useState<string|null>(null);
 const[error,setError]=useState('');

 useEffect(()=>{void load()},[]);

 async function load(){
  const client=supabase;
  if(!client){setLoading(false);return}
  setLoading(true);setError('');
  const{data:{user}}=await client.auth.getUser();
  if(!user){setLoading(false);return}

  const[invoiceResult,missionResult]=await Promise.all([
   client.from('mission_invoices').select('id,mission_id,status,amount_cents,hosted_invoice_url,created_at,due_at').eq('company_id',user.id).order('created_at',{ascending:false}),
   client.from('missions').select('id,title,service_fee_cents,compensation_cents,updated_at').eq('company_id',user.id).eq('status','completed').order('updated_at',{ascending:false})
  ]);

  if(invoiceResult.error||missionResult.error){
   setError((invoiceResult.error||missionResult.error)?.message||'Unable to load billing');
  }else{
   const invoiceRows=(invoiceResult.data||[]) as Invoice[];
   const invoicedIds=new Set(invoiceRows.map(x=>x.mission_id));
   setInvoices(invoiceRows);
   setPendingMissions(((missionResult.data||[]) as CompletedMission[]).filter(x=>!invoicedIds.has(x.id)));
  }
  setLoading(false);
 }

 async function generate(missionId:string){
  const client=supabase;
  if(!client)return;
  setCreating(missionId);setError('');
  const{data,error:invokeError}=await client.functions.invoke('create-mission-invoice',{body:{mission_id:missionId}});
  setCreating(null);
  if(invokeError){setError(invokeError.message);return}
  if(data?.hosted_invoice_url)await Linking.openURL(data.hosted_invoice_url);
  await load();
 }

 return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.container}>
  <Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Company</Text></Pressable>
  <Text style={s.eyebrow}>MEDICREW BILLING</Text>
  <Text style={s.title}>Company invoices.</Text>
  <Text style={s.sub}>The professional is paid directly by your company after the mission. MediCrew separately invoices your company for the platform service fee agreed when the mission was published.</Text>

  <View style={s.card}><Text style={s.cardTitle}>How it works</Text>
   <Step n="1" title="Publish the mission" text="You choose the professional fee and see the MediCrew service fee in real time."/>
   <Step n="2" title="Accept billing terms" text="You accept the versioned billing terms before the mission is published."/>
   <Step n="3" title="Complete the mission" text="The professional is paid directly by the company outside MediCrew."/>
   <Step n="4" title="Generate the MediCrew invoice" text="Once both sides confirm completion, generate the Stripe-hosted invoice for the agreed service fee."/>
   <Step n="5" title="Pay the invoice" text="Open the secure Stripe invoice page to pay. Payment status is confirmed by signed Stripe webhooks."/>
  </View>

  {error?<Text style={s.error}>{error}</Text>:null}

  <Text style={s.section}>Ready to invoice</Text>
  {loading?<Text style={s.meta}>Loading…</Text>:pendingMissions.length===0?<View style={s.empty}><Text style={s.emptyTitle}>Nothing waiting for an invoice</Text><Text style={s.meta}>Completed missions that do not yet have a MediCrew invoice will appear here.</Text></View>:pendingMissions.map(m=><View key={m.id} style={s.invoice}>
   <View style={s.row}><View style={{flex:1}}><Text style={s.invoiceTitle}>{m.title||`Mission ${m.id.slice(0,8)}`}</Text><Text style={s.meta}>Professional fee €{(m.compensation_cents/100).toFixed(2)}</Text></View><Text style={s.amount}>€{(m.service_fee_cents/100).toFixed(2)}</Text></View>
   <Pressable disabled={creating===m.id} style={[s.generateButton,creating===m.id&&{opacity:.6}]} onPress={()=>void generate(m.id)}><Text style={s.payText}>{creating===m.id?'Creating invoice…':'Generate secure invoice'}</Text></Pressable>
  </View>)}

  <Text style={s.section}>Invoices</Text>
  {loading?<Text style={s.meta}>Loading…</Text>:invoices.length===0?<View style={s.empty}><Text style={s.emptyTitle}>No invoices yet</Text><Text style={s.meta}>Invoices are created after completed missions.</Text></View>:invoices.map(i=><View key={i.id} style={s.invoice}>
   <View style={s.row}><View style={{flex:1}}><Text style={s.invoiceTitle}>Mission {i.mission_id.slice(0,8)}</Text><Text style={s.meta}>{new Date(i.created_at).toLocaleDateString()}</Text></View><Text style={s.amount}>€{(i.amount_cents/100).toFixed(2)}</Text></View>
   <View style={s.row}><Text style={s.status}>{i.status.toUpperCase()}</Text>{i.hosted_invoice_url?<Pressable style={s.payButton} onPress={()=>void Linking.openURL(i.hosted_invoice_url!)}><Text style={s.payText}>{i.status==='paid'?'View invoice':'Pay invoice'}</Text></Pressable>:null}</View>
  </View>)}

  <View style={s.notice}><Text style={s.noticeTitle}>Secure billing</Text><Text style={s.noticeText}>MediCrew never stores your card details. Stripe hosts the invoice payment page and confirms payment through signed webhooks.</Text></View>
 </ScrollView></SafeAreaView>
}

function Step({n,title,text}:{n:string;title:string;text:string}){return <View style={s.step}><View style={s.num}><Text style={s.numText}>{n}</Text></View><View style={{flex:1}}><Text style={s.stepTitle}>{title}</Text><Text style={s.stepText}>{text}</Text></View></View>}

const s=StyleSheet.create({safe:{flex:1,backgroundColor:colors.paper},container:{padding:22,paddingBottom:50},back:{fontSize:15,fontWeight:'800',color:colors.ink,marginBottom:24},eyebrow:{fontSize:10,fontWeight:'900',letterSpacing:1.5,color:colors.green},title:{fontSize:34,fontWeight:'900',color:colors.ink,marginTop:7},sub:{fontSize:13,lineHeight:20,color:colors.muted,marginTop:7},card:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:radii.lg,padding:18,marginTop:20},cardTitle:{fontSize:17,fontWeight:'900',color:colors.ink,marginBottom:8},step:{flexDirection:'row',gap:12,paddingVertical:12,borderBottomWidth:1,borderBottomColor:colors.line},num:{width:28,height:28,borderRadius:14,backgroundColor:colors.greenSoft,alignItems:'center',justifyContent:'center'},numText:{fontSize:12,fontWeight:'900',color:colors.greenDark},stepTitle:{fontSize:13,fontWeight:'900',color:colors.ink},stepText:{fontSize:11,lineHeight:17,color:colors.muted,marginTop:3},section:{fontSize:18,fontWeight:'900',color:colors.ink,marginTop:24,marginBottom:10},invoice:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:16,padding:15,marginBottom:9},row:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},invoiceTitle:{fontSize:13,fontWeight:'900',color:colors.ink},amount:{fontSize:17,fontWeight:'900',color:colors.ink},meta:{fontSize:11,color:colors.muted,marginTop:4},status:{fontSize:9,fontWeight:'900',color:colors.greenDark,marginTop:10},payButton:{backgroundColor:colors.ink,borderRadius:10,paddingHorizontal:12,paddingVertical:9,marginTop:8},generateButton:{backgroundColor:colors.ink,borderRadius:10,paddingHorizontal:12,paddingVertical:11,marginTop:12,alignItems:'center'},payText:{color:colors.white,fontSize:11,fontWeight:'900'},empty:{backgroundColor:colors.white,borderWidth:1,borderColor:colors.line,borderRadius:16,padding:18},emptyTitle:{fontSize:15,fontWeight:'900',color:colors.ink},notice:{backgroundColor:colors.ink,borderRadius:radii.lg,padding:18,marginTop:18},noticeTitle:{fontSize:14,fontWeight:'900',color:colors.green},noticeText:{fontSize:11,lineHeight:18,color:'#D9DFDC',marginTop:6},error:{color:'#A33A3A',fontSize:11,marginTop:14}});
