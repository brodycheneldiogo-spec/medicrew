import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-cron-secret'};
type Token={id:string;profile_id:string;expo_push_token:string;platform:string};
type QueueItem={id:string;profile_id:string;title:string;body:string;data:Record<string,unknown>};
type EmailItem={id:string;profile_id:string;recipient_email:string;subject:string;body_text:string;body_html:string|null};

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  const url=Deno.env.get('SUPABASE_URL');const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!serviceKey)throw new Error('Supabase service configuration is missing');
  const admin=createClient(url,serviceKey);
  const cronSecret=Deno.env.get('PUSH_DISPATCH_SECRET');
  let authorized=!!cronSecret&&req.headers.get('x-cron-secret')===cronSecret;
  if(!authorized){
   const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
   if(token){const{data:{user}}=await admin.auth.getUser(token);if(user){const{data:profile}=await admin.from('profiles').select('role').eq('id',user.id).maybeSingle();authorized=profile?.role==='admin'}}
  }
  if(!authorized)return new Response('Unauthorized',{status:401,headers:cors});
  let processed=0;let emailsProcessed=0;
  const{data:queue,error:queueError}=await admin.from('notification_push_queue').select('id,profile_id,title,body,data').is('delivered_at',null).order('created_at',{ascending:true}).limit(100);if(queueError)throw queueError;
  for(const item of ((queue||[]) as QueueItem[])){
   const{data:tokens,error:tokenError}=await admin.from('push_tokens').select('id,profile_id,expo_push_token,platform').eq('profile_id',item.profile_id);if(tokenError)throw tokenError;
   const valid=(tokens||[]) as Token[];
   if(!valid.length){await admin.from('notification_push_queue').update({delivered_at:new Date().toISOString()}).eq('id',item.id);processed++;continue;}
   const messages=valid.map(token=>({to:token.expo_push_token,sound:'default',title:item.title,body:item.body,data:item.data,channelId:'missions'}));
   const response=await fetch('https://exp.host/--/api/v2/push/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(messages)});if(!response.ok)throw new Error(`Expo push service returned ${response.status}`);
   const result=await response.json().catch(()=>null) as {data?:Array<{status?:string;details?:{error?:string}}>}|null;const tickets=result?.data||[];
   if(tickets.some(ticket=>ticket.status==='error'&&ticket.details?.error!=='DeviceNotRegistered'))throw new Error('Expo rejected one or more push notifications');
   const staleTokens=valid.filter((_,index)=>tickets[index]?.details?.error==='DeviceNotRegistered').map(token=>token.id);if(staleTokens.length)await admin.from('push_tokens').delete().in('id',staleTokens);
   await admin.from('notification_push_queue').update({delivered_at:new Date().toISOString()}).eq('id',item.id);processed++;
  }

  const{data:emailQueue,error:emailError}=await admin.from('notification_email_queue').select('id,profile_id,recipient_email,subject,body_text,body_html').is('sent_at',null).is('failed_at',null).order('created_at',{ascending:true}).limit(50);if(emailError)throw emailError;
  const resendKey=Deno.env.get('RESEND_API_KEY');const fromEmail=Deno.env.get('RESEND_FROM_EMAIL')||'MediCrew <notifications@medicrew.app>';
  if(resendKey){
   for(const item of ((emailQueue||[]) as EmailItem[])){
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:fromEmail,to:[item.recipient_email],subject:item.subject,text:item.body_text,html:item.body_html||undefined})});
    if(response.ok){await admin.from('notification_email_queue').update({sent_at:new Date().toISOString()}).eq('id',item.id);emailsProcessed++}
    else{const message=await response.text();await admin.from('notification_email_queue').update({failed_at:new Date().toISOString(),error_message:message.slice(0,500)}).eq('id',item.id)}
   }
  }
  return new Response(JSON.stringify({processed,emailsProcessed,emailPending:(emailQueue||[]).length-emailsProcessed}),{headers:{...cors,'Content-Type':'application/json'}});
 }catch(error){return new Response(JSON.stringify({error:error instanceof Error?error.message:'Notification dispatch failed'}),{status:500,headers:{...cors,'Content-Type':'application/json'}})}
});
