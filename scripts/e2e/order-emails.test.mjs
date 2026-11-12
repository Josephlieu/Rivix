// Checks the email a customer gets when an admin changes an order's stage or adds shipping details
// (the texts, and that a failed email never undoes the change).
// Run against DEV only, with the dev server started as `EMAIL_DRY_RUN=1 npm run dev`:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/order-emails.test.mjs
// With dry run on, the server log shows one "[email dry run]" line per stage change. Creates throwaway 'zz-' accounts and removes them.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
import { stepUp } from './mfa.mjs'; // task 8: admin sessions need the two-step sign-in
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x);

// --- the texts
const { orderUpdateEmail } = await import('../../src/lib/order-emails.ts');
let m=orderUpdateEmail({company:'Sayem Co',to:'sayem@example.com',batch:'ORD-0042',stage:'In Production',note:'Fabric cut today'});
ok('goes to the customer contact email',m.to==='sayem@example.com');
ok('subject names the batch and the new stage',m.subject==='Order ORD-0042 is now In Production');
ok('text has the batch, stage and the admin note',/ORD-0042/.test(m.text)&&/In Production/.test(m.text)&&/Fabric cut today/.test(m.text));
ok('no tracking box when there are no shipping details',!/Shipping details/.test(m.text)&&!/Shipping details/.test(m.html));
m=orderUpdateEmail({company:'Sayem Co',to:'s@example.com',batch:'ORD-0042',stage:'Shipped',carrier:'Purolator',tracking:'PU123'});
ok('stage + shipping in one email',/is now Shipped/.test(m.subject)&&/Carrier: Purolator/.test(m.text)&&/Tracking number: PU123/.test(m.text)&&/PU123/.test(m.html));
m=orderUpdateEmail({company:'Sayem Co',to:'s@example.com',batch:'ORD-0042',tracking:'PU999'});
ok('shipping only: its own subject, and only the field that is set',m.subject==='Shipping details for order ORD-0042'&&/PU999/.test(m.text)&&!/Carrier:/.test(m.text));
m=orderUpdateEmail({batch:'ORD-1',stage:'Delivered'});
ok('missing details never print "undefined" or "null"',!/undefined|null/.test(m.text+m.subject)&&m.to===null);

process.env.NEXT_PUBLIC_SITE_URL='https://portal.example.com/';
const { orderUpdateEmail: withSite } = await import('../../src/lib/order-emails.ts?site');
m=withSite({company:'Sayem Co',to:'s@example.com',batch:'ORD-0042',stage:'Shipped'});
ok('links to the order page in the portal (text and button)',m.text.includes('https://portal.example.com/portal/orders/ORD-0042')&&/href="https:\/\/portal\.example\.com\/portal\/orders\/ORD-0042"/.test(m.html));
ok('the HTML version is branded',/<html/.test(m.html)&&/cid:rivix-logo/.test(m.html));
m=withSite({company:'<script>alert(1)</script>',to:'s@example.com',batch:'ORD-1',stage:'Shipped',note:'<b>hi</b>',carrier:'<i>X</i>'});
ok('anything typed by a person is escaped',!/<script>|<b>hi|<i>X/.test(m.html)&&/&lt;script&gt;/.test(m.html));

// --- the route (dev server + dev database)
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const a=createClient(U,(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY),{auth:{persistSession:false}});
const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,x)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(x?{app_metadata:x}:{})})).data.user;
const adm=await mk(`zz-oe-a-${t}@yopmail.com`,{role:'admin'}), ru=await mk(`zz-oe-r-${t}@yopmail.com`,{role:'rep'}), cu=await mk(`zz-oe-c-${t}@yopmail.com`), cu2=await mk(`zz-oe-c2-${t}@yopmail.com`);
const {data:rep}=await a.from('reps').insert({name:'ZZ OE Rep',email:ru.email,user_id:ru.id}).select().single();
const {data:c}=await a.from('customers').insert({user_id:cu.id,company_name:'ZZ Order Mail',contact_email:cu.email,customer_code:'',rep_id:rep.id}).select().single();
const {data:c2}=await a.from('customers').insert({user_id:cu2.id,company_name:'ZZ No Email',contact_email:null,customer_code:''}).select().single();
const mkOrder=async(cust,repId)=>(await a.from('orders').insert({customer_id:cust.id,rep_id:repId,batch_number:'',product_name:'Mail test',quantity:1}).select().single()).data;
const o=await mkOrder(c,rep.id), o2=await mkOrder(c2,null);
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const r=await sb.auth.signInWithPassword({email:e,password:pw});if(r.error)throw r.error;await stepUp(sb);return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(mt,url,ck,body)=>fetch('http://localhost:10001'+url,{method:mt,headers:{'Content-Type':'application/json',...(ck?{Cookie:ck}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
const status=async id=>(await a.from('orders').select('status,carrier,tracking_number').eq('id',id).single()).data;
try{
  const ac=await cookie(adm.email), rc=await cookie(ru.email), cc=await cookie(cu.email);
  for(const [n,ck] of [['rep',rc],['customer',cc],['signed-out',null]]){
    const r=await call('PATCH',`/api/admin/orders/${o.id}`,ck,{status:'Shipped'}); ok(`${n} cannot change the stage`,r.status===401||r.status>=300);
  }
  let r=await call('PATCH',`/api/admin/orders/${o.id}`,ac,{status:'In Production',note:'Fabric cut'}); let j=await r.json();
  ok('admin changes the stage',r.status===200&&j.changed===true&&(await status(o.id)).status==='In Production');
  ok('an email problem (if any) is a warning, not an error',j.emailWarning===undefined||/email/i.test(j.emailWarning),j.emailWarning||'(no warning: email went out or dry run)');
  const n=await a.from('notifications').select('kind').eq('recipient_user_id',cu.id).eq('kind','stage_changed'); ok('the in-app alert is still sent',n.data?.length>=1);
  r=await call('PATCH',`/api/admin/orders/${o.id}`,ac,{status:'In Production'}); j=await r.json(); ok('same stage again: no change and no email warning',j.changed===false&&j.emailWarning===undefined);
  r=await call('PATCH',`/api/admin/orders/${o.id}`,ac,{carrier:'Purolator',tracking_number:'PU123'}); j=await r.json();
  const s=await status(o.id); ok('adding tracking saves it (email or warning aside)',r.status===200&&s.carrier==='Purolator'&&s.tracking_number==='PU123'&&(j.emailWarning===undefined||/email/i.test(j.emailWarning)));
  r=await call('PATCH',`/api/admin/orders/${o.id}`,ac,{carrier:'',tracking_number:''}); j=await r.json(); ok('clearing shipping sends no email (so no warning)',r.status===200&&j.emailWarning===undefined);
  r=await call('PATCH',`/api/admin/orders/${o2.id}`,ac,{status:'Shipped'}); j=await r.json();
  ok('customer with no email on file: the stage still changes',r.status===200&&(await status(o2.id)).status==='Shipped');
  ok('  and the admin is told the email was not sent',/not sent/.test(j.emailWarning||'')&&/no email address/.test(j.emailWarning||''),j.emailWarning);
}catch(e){console.log('ERROR',e)}finally{
  await a.from('orders').delete().in('customer_id',[c.id,c2.id]); await a.from('customers').delete().in('id',[c.id,c2.id]); await a.from('reps').delete().eq('id',rep.id);
  for(const u of [adm,ru,cu,cu2]) await a.auth.admin.deleteUser(u.id); console.log('cleaned');
}
