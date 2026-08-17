import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authentication required');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Session expired');
    const { paymentId } = await req.json();
    const { data: payment, error } = await admin.from('mission_payments').select('*').eq('id', paymentId).eq('company_id', user.id).single();
    if (error || !payment) throw new Error('Payment not found');
    if (!payment.stripe_payment_intent_id) throw new Error('Stripe payment has not been initialized');
    const key = Deno.env.get('STRIPE_SECRET_KEY');
    if (!key) throw new Error('Payment service is not configured');
    const stripe = new Stripe(key, { apiVersion: '2025-03-31.basil' });
    const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
    if (intent.status === 'succeeded') {
      await admin.from('mission_payments').update({ status: 'paid', stripe_charge_id: typeof intent.latest_charge === 'string' ? intent.latest_charge : null, paid_at: payment.paid_at || new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', payment.id);
      return new Response(JSON.stringify({ status: 'paid' }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    if (intent.status === 'canceled') await admin.from('mission_payments').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', payment.id);
    return new Response(JSON.stringify({ status: intent.status }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to sync payment' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
