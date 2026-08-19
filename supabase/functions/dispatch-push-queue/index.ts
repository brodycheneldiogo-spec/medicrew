import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

type Token = { id: string; profile_id: string; expo_push_token: string; platform: string };
type QueueItem = { id: string; profile_id: string; title: string; body: string; data: Record<string, unknown> };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const cronSecret = Deno.env.get('PUSH_DISPATCH_SECRET');
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: 'Push dispatcher is not configured' }), {
      status: 503,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
  if (req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401, headers: cors });
  }

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) throw new Error('Supabase service configuration is missing');

    const admin = createClient(url, serviceKey);
    const { data: queue, error: queueError } = await admin
      .from('notification_push_queue')
      .select('id,profile_id,title,body,data')
      .is('delivered_at', null)
      .order('created_at', { ascending: true })
      .limit(100);
    if (queueError) throw queueError;

    const items = (queue || []) as QueueItem[];
    if (!items.length) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    for (const item of items) {
      const { data: tokens, error: tokenError } = await admin
        .from('push_tokens')
        .select('id,profile_id,expo_push_token,platform')
        .eq('profile_id', item.profile_id);
      if (tokenError) throw tokenError;

      const valid = (tokens || []) as Token[];
      if (!valid.length) {
        await admin.from('notification_push_queue').update({ delivered_at: new Date().toISOString() }).eq('id', item.id);
        processed++;
        continue;
      }

      const messages = valid.map((token) => ({
        to: token.expo_push_token,
        sound: 'default',
        title: item.title,
        body: item.body,
        data: item.data,
        channelId: 'missions',
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
      if (!response.ok) throw new Error(`Expo push service returned ${response.status}`);

      const result = await response.json().catch(() => null) as { data?: Array<{ status?: string; details?: { error?: string } }> } | null;
      const tickets = result?.data || [];
      const hasFatalTicketError = tickets.some((ticket) => ticket.status === 'error' && ticket.details?.error !== 'DeviceNotRegistered');
      if (hasFatalTicketError) throw new Error('Expo rejected one or more push notifications');

      const staleTokens = valid.filter((_, index) => tickets[index]?.details?.error === 'DeviceNotRegistered').map((token) => token.id);
      if (staleTokens.length) {
        await admin.from('push_tokens').delete().in('id', staleTokens);
      }

      await admin.from('notification_push_queue').update({ delivered_at: new Date().toISOString() }).eq('id', item.id);
      processed++;
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Push dispatch failed' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
