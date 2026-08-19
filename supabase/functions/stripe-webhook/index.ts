import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

Deno.serve(async(req)=>{
 const signature=req.headers.get('stripe-signature');const secret=Deno.env.get('STRIPE_WEBHOOK_SECRET');const stripeKey=Deno.env.get('STRIPE_SECRET_KEY');
 if(!signature||!secret||!stripeKey)return new Response('Webhook not configured',{status:400});
 const body=await req.text();
 try{
  const stripe=new Stripe(stripeKey,{apiVersion:'2026-06-24.dahlia'});
  const event=await stripe.webhooks.constructEventAsync(body,signature,secret);
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const{error:claimError}=await admin.from('stripe_webhook_events').insert({event_id:event.id,event_type:event.type});
  if(claimError){if(claimError.code==='23505'){const{data:existing}=await admin.from('stripe_webhook_events').select('processed_at').eq('event_id',event.id).maybeSingle();if(existing?.processed_at)return new Response(JSON.stringify({received:true,duplicate:true}),{status:200,headers:{'Content-Type':'application/json'}})}else throw claimError}

  if(event.type==='invoice.paid'||event.type==='invoice.payment_failed'||event.type==='invoice.voided'||event.type==='invoice.marked_uncollectible'){
    const invoice=event.data.object as Stripe.Invoice;const missionId=invoice.metadata?.medicrew_mission_id;
    if(missionId){
      const status=event.type==='invoice.paid'?'paid':event.type==='invoice.payment_failed'?'failed':event.type==='invoice.voided'?'void':'uncollectible';
      await admin.from('mission_invoices').update({status,paid_at:event.type==='invoice.paid'?new Date().toISOString():null,hosted_invoice_url:invoice.hosted_invoice_url||null,invoice_pdf_url:invoice.invoice_pdf||null,updated_at:new Date().toISOString()}).eq('mission_id',missionId);
      const{data:mission}=await admin.from('missions').select('company_id').eq('id',missionId).maybeSingle();
      if(mission){
        const title=event.type==='invoice.paid'?'MediCrew invoice paid':event.type==='invoice.payment_failed'?'MediCrew invoice payment failed':'MediCrew invoice updated';
        const bodyText=event.type==='invoice.paid'?'Your MediCrew service-fee invoice has been paid.':event.type==='invoice.payment_failed'?'Your MediCrew service-fee invoice could not be paid. Please use the invoice link to retry.':'Your MediCrew invoice status has changed.';
        await admin.from('notifications').insert({profile_id:mission.company_id,title,body:bodyText,type:'billing_invoice',data:{mission_id:missionId,invoice_id:invoice.id,email:true,url:invoice.hosted_invoice_url||null}});
      }
    }
  }

  if(event.type==='payment_intent.succeeded'||event.type==='payment_intent.payment_failed'){
    const intent=event.data.object as Stripe.PaymentIntent;const paymentId=intent.metadata?.payment_id;
    if(paymentId){
      const status=event.type==='payment_intent.succeeded'?'paid':'failed';
      await admin.from('mission_payments').update({status,paid_at:event.type==='payment_intent.succeeded'?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',paymentId);
    }
  }
  if(event.type==='charge.refunded'){
    const charge=event.data.object as Stripe.Charge;const paymentIntentId=typeof charge.payment_intent==='string'?charge.payment_intent:charge.payment_intent?.id;
    if(paymentIntentId)await admin.from('mission_payments').update({status:'refunded',refunded_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('stripe_payment_intent_id',paymentIntentId);
  }
  if(event.type==='account.updated'){
    const account=event.data.object as Stripe.Account;const profileId=account.metadata?.profile_id;
    if(profileId)await admin.from('professionals').update({stripe_connect_onboarding_complete:!!account.payouts_enabled&&!!account.details_submitted,updated_at:new Date().toISOString()}).eq('id',profileId);
  }
  await admin.from('stripe_webhook_events').update({processed_at:new Date().toISOString()}).eq('event_id',event.id);
  return new Response(JSON.stringify({received:true}),{status:200,headers:{'Content-Type':'application/json'}});
 }catch(error){console.error(error);return new Response(error instanceof Error?error.message:'Invalid webhook',{status:400})}
});
