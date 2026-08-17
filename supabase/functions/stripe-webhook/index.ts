import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!signature || !secret || !stripeKey) return new Response('Webhook not configured', { status: 400 });
  const body = await req.text();
  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' });
    const event = await stripe.webhooks.constructEventAsync(body, signature, secret);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    if (event.type.startsWith('payment_intent.')) {
      const intent = event.data.object as Stripe.PaymentIntent;
      const paymentId = intent.metadata?.payment_id;
      if (paymentId && event.type === 'payment_intent.succeeded') {
        await admin.from('mission_payments').update({ status:'paid', stripe_charge_id:typeof intent.latest_charge==='string'?intent.latest_charge:null, paid_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq('id',paymentId);
      }
      if (paymentId && event.type === 'payment_intent.payment_failed') {
        await admin.from('mission_payments').update({ status:'failed', updated_at:new Date().toISOString() }).eq('id',paymentId);
      }
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (paymentIntentId) await admin.from('mission_payments').update({ status:'refunded', refunded_at:new Date().toISOString(), updated_at:new Date().toISOString() }).eq('stripe_payment_intent_id',paymentIntentId);
    }

    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      const profileId = account.metadata?.profile_id;
      if (profileId) await admin.from('professionals').update({ stripe_connect_onboarding_complete:!!account.payouts_enabled && !!account.details_submitted, updated_at:new Date().toISOString() }).eq('id',profileId);
    }

    return new Response(JSON.stringify({received:true}), { status:200, headers:{'Content-Type':'application/json'} });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : 'Invalid webhook', { status:400 });
  }
});
