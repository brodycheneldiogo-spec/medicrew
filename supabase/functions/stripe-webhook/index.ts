import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

Deno.serve(async(req)=>{
 const signature=req.headers.get('stripe-signature');const secret=Deno.env.get('STRIPE_WEBHOOK_SECRET');const stripeKey=Deno.env.get('STRIPE_SECRET_KEY');
 if(!signature||!secret||!stripeKey)return new Response('Webhook not configured',{status:400});
 const body=await req.text();
 try{
  const stripe=new Stripe(stripeKey,{apiVersion:'2025-03-31.basil'});const event=await stripe.webhooks.constructEventAsync(body,signature,secret);const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const{data:claim,error:claimError}=await admin.from('stripe_webhook_events').insert({event_id:event.id,event_type:event.type});
  if(claimError){if(claimError.code==='23505')return new Response(JSON.stringify({received:true,duplicate:true}),{status:200,headers:{'Content-Type':'application/json'}});throw claimError}
  if(event.type.startsWith('payment_intent.')){
   const intent=event.data.object as Stripe.PaymentIntent;const paymentId=intent.metadata?.payment_id;
   if(paymentId&&event.type==='payment_intent.succeeded'){
    const{data:payment}=await admin.from('mission_payments').select('id,mission_id,company_id,professional_id,amount_cents').eq('id',paymentId).maybeSingle();
    await admin.from('mission_payments').update({status:'paid',stripe_charge_id:typeof intent.latest_charge==='string'?intent.latest_charge:null,paid_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',paymentId);
    if(payment)await admin.from('notifications').insert([{profile_id:payment.company_id,title:'Payment confirmed',body:`Mission payment of €${(payment.amount_cents/100).toFixed(2)} was confirmed by Stripe.`,type:'payment_paid',data:{mission_id:payment.mission_id,payment_id:payment.id,email:true}},{profile_id:payment.professional_id,title:'Mission payment secured',body:'The company payment for your MediCrew mission has been confirmed. The mission can now start.',type:'payment_paid',data:{mission_id:payment.mission_id,payment_id:payment.id,email:true}}]);
   }
   if(paymentId&&event.type==='payment_intent.payment_failed'){
    const{data:payment}=await admin.from('mission_payments').select('id,mission_id,company_id').eq('id',paymentId).maybeSingle();
    await admin.from('mission_payments').update({status:'failed',updated_at:new Date().toISOString()}).eq('id',paymentId);
    if(payment)await admin.from('notifications').insert({profile_id:payment.company_id,title:'Payment failed',body:'The mission payment could not be completed. Please retry the MediCrew payment flow before starting the mission.',type:'payment_failed',data:{mission_id:payment.mission_id,payment_id:payment.id,email:true}});
   }
  }
  if(event.type==='charge.refunded'){
   const charge=event.data.object as Stripe.Charge;const paymentIntentId=typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id;
   if(paymentIntentId){const{data:payment}=await admin.from('mission_payments').select('id,mission_id,company_id,professional_id').eq('stripe_payment_intent_id',paymentIntentId).maybeSingle();await admin.from('mission_payments').update({status:'refunded',refunded_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('stripe_payment_intent_id',paymentIntentId);if(payment)await admin.from('notifications').insert([{profile_id:payment.company_id,title:'Payment refunded',body:'The MediCrew mission payment has been refunded.',type:'payment_refunded',data:{mission_id:payment.mission_id,payment_id:payment.id,email:true}},{profile_id:payment.professional_id,title:'Mission payment refunded',body:'The payment attached to this mission has been refunded and the mission cannot proceed as originally paid.',type:'payment_refunded',data:{mission_id:payment.mission_id,payment_id:payment.id,email:true}}]);}
  }
  if(event.type==='account.updated'){const account=event.data.object as Stripe.Account;const profileId=account.metadata?.profile_id;if(profileId)await admin.from('professionals').update({stripe_connect_onboarding_complete:!!account.payouts_enabled&&!!account.details_submitted,updated_at:new Date().toISOString()}).eq('id',profileId)}
  await admin.from('stripe_webhook_events').update({processed_at:new Date().toISOString()}).eq('event_id',event.id);
  return new Response(JSON.stringify({received:true}),{status:200,headers:{'Content-Type':'application/json'}});
 }catch(error){return new Response(error instanceof Error?error.message:'Invalid webhook',{status:400})}
});
