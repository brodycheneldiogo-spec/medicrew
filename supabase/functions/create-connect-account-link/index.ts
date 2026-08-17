import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Authentication required');
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) throw new Error('Session expired');

    const { data: profile } = await client.from('profiles').select('role,first_name,last_name,email').eq('id', user.id).single();
    if (profile?.role !== 'professional') throw new Error('Professional account required');
    const { data: professional, error: professionalError } = await admin.from('professionals').select('stripe_connect_account_id').eq('id', user.id).single();
    if (professionalError) throw professionalError;

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('Payment service is not configured');
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-03-31.basil' });
    let accountId = professional.stripe_connect_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: profile.email || user.email || undefined,
        metadata: { profile_id: user.id },
        capabilities: { transfers: { requested: true } },
      });
      accountId = account.id;
      await admin.from('professionals').update({ stripe_connect_account_id: accountId, stripe_connect_onboarding_complete: false, updated_at: new Date().toISOString() }).eq('id', user.id);
    }

    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://medicrew.app';
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appBaseUrl}/stripe/refresh`,
      return_url: `${appBaseUrl}/stripe/return`,
      type: 'account_onboarding',
    });

    return new Response(JSON.stringify({ url: link.url }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unable to start payout onboarding' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
