import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authentication required');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error('Session expired');
    const { missionId } = await req.json();
    const { data: allowed, error: allowedError } = await userClient.rpc('mark_payment_release_ready', { p_mission_id: missionId });
    if (allowedError) throw allowedError;
    if (!allowed) throw new Error('Payment is not ready');

    const { data: payment, error: paymentError } = await admin.from('mission_payments').select('*,professionals!mission_payments_professional_id_fkey(stripe_connect_account_id,stripe_connect_onboarding_complete)').eq('mission_id', missionId).single();
    if (paymentError || !payment) throw new Error('Payment record not found');
    if (payment.status === 'released') return new Response(JSON.stringify({ released: true, transferId: payment.stripe_transfer_id }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    if (payment.status !== 'paid') throw new Error('Payment must be paid before release');

    const account = Array.isArray(payment.professionals) ? payment.professionals[0] : payment.professionals;
    if (!account?.stripe_connect_account_id || !account.stripe_connect_onboarding_complete) throw new Error('Professional payout account is not ready');

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('Payment service is not configured');
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' });
    const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
    if (intent.status !== 'succeeded') throw new Error('Stripe payment is not settled');

    const transfer = await stripe.transfers.create({
      amount: payment.professional_amount_cents,
      currency: payment.currency,
      destination: account.stripe_connect_account_id,
      transfer_group: `mission_${missionId}`,
      source_transaction: typeof intent.latest_charge === 'string' ? intent.latest_charge : undefined,
      metadata: { mission_id: missionId, payment_id: payment.id, platform_fee_cents: String(payment.platform_fee_cents) },
    });

    await admin.from('mission_payments').update({ status: 'released', stripe_transfer_id: transfer.id, released_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', payment.id);
    return new Response(JSON.stringify({ released: true, transferId: transfer.id, professionalAmountCents: payment.professional_amount_cents, platformFeeCents: payment.platform_fee_cents }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Payment release failed' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
