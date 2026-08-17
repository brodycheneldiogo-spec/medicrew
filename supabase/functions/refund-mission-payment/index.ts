import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authentication required');
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global:{headers:{Authorization:authHeader}} });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data:{user} } = await client.auth.getUser();
    if (!user) throw new Error('Session expired');
    const { missionId } = await req.json();
    const { data: mission, error: missionError } = await admin.from('missions').select('id,company_id,status').eq('id',missionId).single();
    if (missionError || !mission || mission.company_id!==user.id) throw new Error('Not authorized to refund this mission');
    if (['in_progress','completed','cancelled'].includes(mission.status)) throw new Error('This mission cannot be refunded at this stage');
    const { data: payment, error: paymentError } = await admin.from('mission_payments').select('*').eq('mission_id',missionId).single();
    if (paymentError || !payment) return new Response(JSON.stringify({ refunded:false, reason:'no_payment' }), { headers:{...cors,'Content-Type':'application/json'} });
    if (payment.status==='refunded') return new Response(JSON.stringify({ refunded:true }), { headers:{...cors,'Content-Type':'application/json'} });
    if (payment.status!=='paid') throw new Error('Payment is not refundable because it has not completed');
    const key=Deno.env.get('STRIPE_SECRET_KEY'); if(!key) throw new Error('Payment service is not configured');
    const stripe=new Stripe(key,{apiVersion:'2025-03-31.basil'});
    await stripe.refunds.create({ payment_intent:payment.stripe_payment_intent_id, metadata:{mission_id:missionId,payment_id:payment.id} });
    await admin.from('mission_payments').update({status:'refunded',refunded_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',payment.id);
    return new Response(JSON.stringify({refunded:true}), { headers:{...cors,'Content-Type':'application/json'} });
  } catch(error) {
    return new Response(JSON.stringify({error:error instanceof Error?error.message:'Refund failed'}),{status:400,headers:{...cors,'Content-Type':'application/json'}});
  }
});
