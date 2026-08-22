import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const stripeKey=Deno.env.get('STRIPE_SECRET_KEY');
const supabaseUrl=Deno.env.get('SUPABASE_URL');
const serviceRole=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

Deno.serve(async(req)=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405});
  if(!stripeKey||!supabaseUrl||!serviceRole)return new Response('Billing is not configured',{status:503});
  const auth=req.headers.get('Authorization');
  if(!auth)return new Response('Unauthorized',{status:401});
  const userClient=createClient(supabaseUrl,Deno.env.get('SUPABASE_ANON_KEY')||'',{global:{headers:{Authorization:auth}}});
  const admin=createClient(supabaseUrl,serviceRole);
  const{data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user)return new Response('Unauthorized',{status:401});
  try{
    const body=await req.json();const missionId=String(body?.mission_id||'');
    if(!missionId)return new Response('mission_id is required',{status:400});
    const{data:mission,error:missionError}=await admin.from('missions').select('id,company_id,status,compensation_cents,compensation_currency,service_fee_cents,title,destination_location').eq('id',missionId).maybeSingle();
    if(missionError||!mission)return new Response('Mission not found',{status:404});
    if(mission.company_id!==user.id)return new Response('Forbidden',{status:403});
    if(mission.status!=='completed')return new Response('The mission must be completed before invoicing',{status:409});
    if(!Number.isInteger(mission.service_fee_cents)||mission.service_fee_cents<0)return new Response('Invalid service fee',{status:422});
    const contractualCurrency=String(mission.compensation_currency||'EUR').toUpperCase();
    if(contractualCurrency!=='EUR'&&contractualCurrency!=='USD')return new Response('Unsupported mission currency',{status:422});
    const stripeCurrency=contractualCurrency.toLowerCase();
    const{data:existing}=await admin.from('mission_invoices').select('*').eq('mission_id',missionId).maybeSingle();
    if(existing?.stripe_invoice_id)return new Response(JSON.stringify(existing),{status:200,headers:{'Content-Type':'application/json'}});
    const{data:company}=await admin.from('companies').select('company_name,contact_name').eq('id',user.id).maybeSingle();
    const{data:profile}=await admin.from('profiles').select('email').eq('id',user.id).maybeSingle();
    const email=String(profile?.email||user.email||'').trim();
    if(!email)return new Response('Company email is required before invoicing',{status:422});
    const stripe=new Stripe(stripeKey,{apiVersion:'2026-06-24.dahlia'});
    const customer=await stripe.customers.create({email,name:company?.company_name||company?.contact_name||'MediCrew company',metadata:{medicrew_company_id:user.id}},{idempotencyKey:`medicrew-customer-${user.id}`});
    await stripe.invoiceItems.create({customer:customer.id,currency:stripeCurrency,amount:mission.service_fee_cents,description:`MediCrew platform service fee · mission ${mission.id}`},{idempotencyKey:`medicrew-invoice-item-${missionId}`});
    const invoice=await stripe.invoices.create({customer:customer.id,collection_method:'send_invoice',days_until_due:7,auto_advance:true,description:`MediCrew service fee for mission ${mission.id}`,metadata:{medicrew_mission_id:mission.id,medicrew_company_id:user.id,professional_fee_cents:String(mission.compensation_cents),service_fee_cents:String(mission.service_fee_cents),currency:contractualCurrency}},{idempotencyKey:`medicrew-invoice-${missionId}`});
    const saved=await admin.from('mission_invoices').upsert({mission_id:mission.id,company_id:user.id,stripe_customer_id:customer.id,stripe_invoice_id:invoice.id,status:invoice.status==='open'?'open':'draft',amount_cents:mission.service_fee_cents,currency:stripeCurrency,hosted_invoice_url:invoice.hosted_invoice_url||null,invoice_pdf_url:invoice.invoice_pdf||null,due_at:invoice.due_date?new Date(invoice.due_date*1000).toISOString():null,updated_at:new Date().toISOString()},{onConflict:'mission_id'}).select('*').single();
    if(saved.error)throw saved.error;
    await admin.from('notifications').insert({profile_id:user.id,title:'MediCrew invoice ready',body:`Your MediCrew service-fee invoice for mission ${mission.id} is ready.`,type:'billing_invoice',data:{mission_id:mission.id,invoice_id:invoice.id,email:true,url:invoice.hosted_invoice_url||null}});
    return new Response(JSON.stringify(saved.data),{status:200,headers:{'Content-Type':'application/json'}});
  }catch(error){console.error(error);return new Response(error instanceof Error?error.message:'Invoice creation failed',{status:500})}
});
