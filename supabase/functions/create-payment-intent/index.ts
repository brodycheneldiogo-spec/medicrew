import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authentication required');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('Payment service is not configured');

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Session expired');

    const { missionId } = await req.json();
    if (!missionId) throw new Error('Mission is required');

    const { data: prepared, error: prepareError } = await userClient.rpc('prepare_mission_payment', { p_mission_id: missionId });
    if (prepareError) throw prepareError;
    const payment = Array.isArray(prepared) ? prepared[0] : prepared;
    if (!payment?.payment_id) throw new Error('Unable to prepare mission payment');

    const { data: existing } = await admin.from('mission_payments').select('*').eq('id', payment.payment_id).single();
    if (!existing) throw new Error('Payment record not found');
    if (existing.status === 'paid' || existing.status === 'released') {
      throw new Error('This mission has already been paid');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' });
    let intent: Stripe.PaymentIntent;
    if (existing.stripe_payment_intent_id) {
      intent = await stripe.paymentIntents.retrieve(existing.stripe_payment_intent_id);
      if (intent.status === 'succeeded') {
        await admin.from('mission_payments').update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', existing.id);
        throw new Error('Payment is already complete');
      }
    } else {
      intent = await stripe.paymentIntents.create({
        amount: existing.amount_cents,
        currency: existing.currency,
        automatic_payment_methods: { enabled: true },
        description: `MediCrew mission ${missionId}`,
        metadata: { mission_id: missionId, payment_id: existing.id, platform_fee_cents: String(existing.platform_fee_cents), professional_amount_cents: String(existing.professional_amount_cents) },
      });
      await admin.from('mission_payments').update({ stripe_payment_intent_id: intent.id, status: 'processing', updated_at: new Date().toISOString() }).eq('id', existing.id);
    }

    return new Response(JSON.stringify({ paymentId: existing.id, clientSecret: intent.client_secret, amountCents: existing.amount_cents, platformFeeCents: existing.platform_fee_cents, professionalAmountCents: existing.professional_amount_cents }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Payment initialization failed' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
