import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

type EmailItem = {
  id: string;
  recipient_email: string;
  subject: string;
  body_text: string;
  body_html: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!url || !serviceKey || !resendKey) throw new Error('Email service configuration is missing');

    const admin = createClient(url, serviceKey);
    const cronSecret = Deno.env.get('EMAIL_DISPATCH_SECRET') || Deno.env.get('PUSH_DISPATCH_SECRET');
    let authorized = Boolean(cronSecret && req.headers.get('x-cron-secret') === cronSecret);

    if (!authorized) {
      const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
      if (token) {
        const { data: { user } } = await admin.auth.getUser(token);
        if (user) {
          const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle();
          authorized = profile?.role === 'admin';
        }
      }
    }

    if (!authorized) return new Response('Unauthorized', { status: 401, headers: cors });

    const { data: emailQueue, error } = await admin
      .from('notification_email_queue')
      .select('id,recipient_email,subject,body_text,body_html')
      .is('sent_at', null)
      .is('failed_at', null)
      .order('created_at', { ascending: true })
      .limit(50);
    if (error) throw error;

    const from = Deno.env.get('RESEND_FROM_EMAIL') || 'MediCrew <notifications@medicrew.app>';
    let sent = 0;
    for (const item of (emailQueue || []) as EmailItem[]) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [item.recipient_email],
          subject: item.subject,
          text: item.body_text,
          html: item.body_html || undefined,
        }),
      });

      if (response.ok) {
        await admin.from('notification_email_queue').update({ sent_at: new Date().toISOString() }).eq('id', item.id);
        sent += 1;
      } else {
        const message = await response.text();
        await admin.from('notification_email_queue').update({
          failed_at: new Date().toISOString(),
          error_message: message.slice(0, 500),
        }).eq('id', item.id);
      }
    }

    return Response.json({ sent, pending: (emailQueue || []).length - sent, push: 'disabled' }, { headers: cors });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Email dispatch failed' },
      { status: 500, headers: cors },
    );
  }
});
