import Stripe from 'npm:stripe@22.4.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const stripeKey = Deno.env.get('STRIPE_RESTRICTED_KEY') || Deno.env.get('STRIPE_SECRET_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!signature || !webhookSecret || !stripeKey || !supabaseUrl || !serviceRole) {
    return new Response('Webhook not configured', { status: 400 });
  }

  const body = await req.text();

  try {
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-07-29.dahlia' });
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    const admin = createClient(supabaseUrl, serviceRole);

    const { error: claimError } = await admin
      .from('stripe_webhook_events')
      .insert({ event_id: event.id, event_type: event.type });

    if (claimError) {
      if (claimError.code === '23505') {
        const { data: existing } = await admin
          .from('stripe_webhook_events')
          .select('processed_at')
          .eq('event_id', event.id)
          .maybeSingle();

        if (existing?.processed_at) {
          return new Response(JSON.stringify({ received: true, duplicate: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } else {
        throw claimError;
      }
    }

    const invoiceEvents = new Set([
      'invoice.paid',
      'invoice.payment_failed',
      'invoice.voided',
      'invoice.marked_uncollectible',
    ]);

    const checkoutEvents = new Set([
      'checkout.session.completed',
      'checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed',
    ]);

    if (checkoutEvents.has(event.type)) {
      const session = event.data.object as Stripe.Checkout.Session;
      const missionId = session.metadata?.medicrew_mission_id;
      if (missionId) {
        const paid = event.type !== 'checkout.session.async_payment_failed' && session.payment_status === 'paid';
        const { error: paymentError } = await admin.from('mission_service_fee_payments').update({
          status: paid ? 'paid' : 'failed',
          stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
          paid_at: paid ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }).eq('mission_id', missionId);
        if (paymentError) throw paymentError;
        if (paid) {
          const { data: mission, error: missionError } = await admin.from('missions').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', missionId).eq('status', 'professional_selected').select('company_id').maybeSingle();
          if (missionError) throw missionError;
          await admin.from('mission_assignments').update({ confirmed_at: new Date().toISOString() }).eq('mission_id', missionId);
          if (mission) {
            const { data: assignment } = await admin.from('mission_assignments').select('professional_id').eq('mission_id', missionId).maybeSingle();
            const rows = [
              { profile_id: mission.company_id, title: 'Service fee paid', body: 'Stripe confirmed the MediCrew service fee. The mission is now confirmed.', type: 'service_fee_paid', data: { mission_id: missionId, email: true } },
              ...(assignment ? [{ profile_id: assignment.professional_id, title: 'Mission confirmed', body: 'The company paid the MediCrew service fee. Your mission is confirmed.', type: 'mission_confirmed', data: { mission_id: missionId, email: true } }] : []),
            ];
            const { error: notificationError } = await admin.from('notifications').insert(rows);
            if (notificationError) throw notificationError;
          }
        }
      }
    }

    if (invoiceEvents.has(event.type)) {
      const invoice = event.data.object as Stripe.Invoice;
      const missionId = invoice.metadata?.medicrew_mission_id;

      if (missionId) {
        const status =
          event.type === 'invoice.paid'
            ? 'paid'
            : event.type === 'invoice.payment_failed'
              ? 'failed'
              : event.type === 'invoice.voided'
                ? 'void'
                : 'uncollectible';

        const { error: updateError } = await admin
          .from('mission_invoices')
          .update({
            status,
            paid_at: event.type === 'invoice.paid' ? new Date().toISOString() : null,
            hosted_invoice_url: invoice.hosted_invoice_url || null,
            invoice_pdf_url: invoice.invoice_pdf || null,
            updated_at: new Date().toISOString(),
          })
          .eq('mission_id', missionId);

        if (updateError) throw updateError;

        const { data: mission, error: missionError } = await admin
          .from('missions')
          .select('company_id')
          .eq('id', missionId)
          .maybeSingle();

        if (missionError) throw missionError;

        if (mission) {
          const title =
            event.type === 'invoice.paid'
              ? 'MediCrew invoice paid'
              : event.type === 'invoice.payment_failed'
                ? 'MediCrew invoice payment failed'
                : event.type === 'invoice.voided'
                  ? 'MediCrew invoice voided'
                  : 'MediCrew invoice requires attention';

          const bodyText =
            event.type === 'invoice.paid'
              ? 'Your MediCrew service-fee invoice has been paid.'
              : event.type === 'invoice.payment_failed'
                ? 'Your MediCrew service-fee invoice could not be paid. Please use the invoice link to retry.'
                : event.type === 'invoice.voided'
                  ? 'Your MediCrew service-fee invoice has been voided.'
                  : 'Your MediCrew service-fee invoice was marked uncollectible. Please contact MediCrew support.';

          const { error: notificationError } = await admin.from('notifications').insert({
            profile_id: mission.company_id,
            title,
            body: bodyText,
            type: 'billing_invoice',
            data: {
              mission_id: missionId,
              invoice_id: invoice.id,
              email: true,
              url: invoice.hosted_invoice_url || null,
            },
          });

          if (notificationError) throw notificationError;
        }
      }
    }

    const { error: processedError } = await admin
      .from('stripe_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('event_id', event.id);

    if (processedError) throw processedError;

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error(error);
    return new Response(error instanceof Error ? error.message : 'Invalid webhook', { status: 400 });
  }
});
