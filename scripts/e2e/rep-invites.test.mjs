// Task 9: rep sign-up links. Only a two-step admin makes, lists, cancels or approves invites. A link works once, for 7
// days, for one email; an expired, used or cancelled link fails; a sign-up cannot give itself the admin role; the new
// rep is INACTIVE and refused everywhere until an admin approves them; the public routes are rate limited.
// Run on DEV only, after audit-docs/deliverables/task-09-rep-invites.sql, with `EMAIL_DRY_RUN=1 npm run dev` running:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/rep-invites.test.mjs
// Creates throwaway 'zz-' accounts and removes them at the end.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import crypto from 'crypto';
import fs from 'fs';
import { stepUp } from './mfa.mjs';
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x);

const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const pw='Tmp-pass-9876!',t=Date.now(), started=new Date().toISOString();
const mk=async(e,x)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(x?{app_metadata:x}:{})})).data.user;
const adm=await mk(`zz-inv-a-${t}@yopmail.com`,{role:'admin'}), ru=await mk(`zz-inv-r-${t}@yopmail.com`,{role:'rep'}), cu=await mk(`zz-inv-c-${t}@yopmail.com`);
const {data:rep}=await a.from('reps').insert({name:'ZZ INV Rep',email:ru.email,user_id:ru.id}).select().single();
const {data:c}=await a.from('customers').insert({user_id:cu.id,company_name:'ZZ INV Co',contact_email:cu.email,customer_code:''}).select().single();
// Each test run uses its own made-up caller IP, so it never shares a rate-limit bucket with anything else.
// Every call gets a fresh made-up IP, except the rate-limit section, which uses one fixed IP on purpose.
let ipN=0; const freshIp=()=>`10.${t%250}.${Math.floor(t/250)%250}.${10+(ipN++%240)}`; const OTHER_IP=`10.${t%250}.${Math.floor(t/250)%250}.8`;
const session=async(email,{two=true}={})=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const x=await sb.auth.signInWithPassword({email,password:email.startsWith('zz-inv-new')?'New-pass-12345':pw});if(x.error)throw x.error;if(two)await stepUp(sb);return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(m,url,ck,body,ip=freshIp())=>fetch('http://localhost:10001'+url,{method:m,headers:{'Content-Type':'application/json','x-real-ip':ip,...(ck?{Cookie:ck}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
const tokenOf=link=>link.split('/join/')[1];
const newEmails=[];
const invite=async(ck,email)=>{const r=await call('POST','/api/admin/rep-invites',ck,{email});const j=await r.json();return {r,j,token:j.link?tokenOf(j.link):null};};
try{
  const ac=await session(adm.email), acPw=await session(adm.email,{two:false}), rc=await session(ru.email), cc=await session(cu.email);

  // --- who may make invites
  for(const [n,ck] of [['password-only admin',acPw],['rep',rc],['customer',cc],['signed-out',null]]){
    let r=await call('POST','/api/admin/rep-invites',ck,{email:`zz-x-${t}@yopmail.com`}); ok(`${n} cannot create an invite`,r.status===401||r.status===403,r.status);
    r=await call('GET','/api/admin/rep-invites',ck); ok(`${n} cannot list invites`,r.status===401||r.status===403);
  }
  let r=await call('POST','/api/admin/rep-invites',ac,{email:'not-an-email'}); ok('a bad email is refused',r.status===400);
  r=await call('POST','/api/admin/rep-invites',ac,{email:ru.email}); ok('an email that already has a rep or login is refused',r.status===409);

  // --- a good link
  const e1=`zz-inv-new1-${t}@yopmail.com`; newEmails.push(e1);
  let inv=await invite(ac,e1);
  ok('a two-step admin creates an invite and gets the link once',inv.r.status===201&&/\/join\/[A-Za-z0-9_-]{40,}$/.test(inv.j.link||''),inv.j.error||'');
  r=await call('POST','/api/admin/rep-invites',ac,{email:e1.toUpperCase()}); ok('a second pending invite for the same email is refused',r.status===409);
  const {data:row1}=await a.from('rep_invites').select('*').eq('id',inv.j.invite.id).single();
  ok('only a hash of the token is stored',row1.token_hash===crypto.createHash('sha256').update(inv.token).digest('hex')&&!JSON.stringify(row1).includes(inv.token));
  ok('it expires after 7 days',Math.abs(new Date(row1.expires_at).getTime()-Date.now()-7*24*3600e3)<5*60e3);
  r=await call('GET',`/api/rep-invites/${inv.token}`,null); let j=await r.json(); ok('the link opens and shows the email it is for',r.status===200&&j.email===e1);
  r=await call('GET',`/api/rep-invites/${inv.token.slice(0,-2)}xx`,null); ok('a tampered token fails',r.status===404);
  r=await call('POST',`/api/rep-invites/${inv.token}`,null,{name:'ZZ New',password:'short'}); ok('a short password is refused (and the link is not used up)',r.status===400&&!(await a.from('rep_invites').select('used_at').eq('id',inv.j.invite.id).single()).data.used_at);
  r=await call('POST',`/api/rep-invites/${inv.token}`,null,{name:'ZZ New Rep One',password:'New-pass-12345',phone:'403 555 0100',role:'admin',app_metadata:{role:'admin'},is_admin:true,email:`zz-evil-${t}@yopmail.com`,rep_id:rep.id,active:true});
  j=await r.json(); ok('the person signs up',r.status===201&&j.status==='awaiting_approval',j.error||'');
  const {data:{users}}=await a.auth.admin.listUsers({page:1,perPage:1000}); const nu=users.find(u=>u.email===e1);
  ok('the login is a rep, never an admin, whatever the sign-up sent',nu?.app_metadata?.role==='rep'&&!users.some(u=>u.email===`zz-evil-${t}@yopmail.com`));
  const {data:nrep}=await a.from('reps').select('*').eq('user_id',nu.id).single();
  ok('a new INACTIVE rep card with the invite email and the name they chose',nrep&&nrep.active===false&&nrep.email===e1&&nrep.name==='ZZ New Rep One'&&nrep.id!==rep.id);
  ok('the new rep has no customers',((await a.from('customers').select('id').eq('rep_id',nrep.id)).data||[]).length===0);
  ok('the existing rep sent as rep_id was not touched',(await a.from('reps').select('user_id').eq('id',rep.id).single()).data.user_id===ru.id);
  ok('every admin is alerted, with a link to the approve button',((await a.from('notifications').select('link').eq('recipient_user_id',adm.id).eq('kind','rep_signup')).data||[]).some(n=>n.link==='/admin/team#rep-invites'));

  // --- the link is used up
  r=await call('GET',`/api/rep-invites/${inv.token}`,null); ok('a used link no longer opens',r.status===404);
  r=await call('POST',`/api/rep-invites/${inv.token}`,null,{name:'Again',password:'New-pass-12345'}); ok('a used link cannot sign up again',r.status===404);
  r=await call('POST',`/api/admin/rep-invites/${inv.j.invite.id}/cancel`,ac); ok('a used invite cannot be cancelled',r.status===409);

  // --- unapproved: refused everywhere
  const nc=await session(e1);
  const page=await fetch('http://localhost:10001/rep',{headers:{Cookie:nc}}); const html=await page.text();
  ok('an unapproved rep sees "waiting for RIVIX to approve" instead of the sales portal',page.status===200&&html.includes('waiting for RIVIX to approve')&&!html.includes('My Customers'));
  for(const p of ['/rep/customers','/rep/orders','/rep/requests']){ const x=await fetch('http://localhost:10001'+p,{headers:{Cookie:nc}}); const h=await x.text(); ok(`  ${p} shows the waiting screen too`,h.includes('waiting for RIVIX to approve')); }
  r=await call('GET','/api/replications',nc); ok('  rep API (replications) refused',r.status===401,r.status);
  r=await call('POST','/api/rep/orders',nc,{customer_id:c.id,items:[{product_name:'x',sizes:[{size:'M',qty:1}]}]}); ok('  rep API (new order) refused',r.status===403,r.status);
  r=await call('POST',`/api/admin/rep-invites/${inv.j.invite.id}/approve`,nc); ok('  and they cannot approve themselves',r.status===401||r.status===403);
  for(const [n,ck] of [['password-only admin',acPw],['rep',rc]]){ r=await call('POST',`/api/admin/rep-invites/${inv.j.invite.id}/approve`,ck); ok(`a ${n} cannot approve`,r.status===401||r.status===403); }

  // --- approved: works
  r=await call('POST',`/api/admin/rep-invites/${inv.j.invite.id}/approve`,ac); ok('a two-step admin approves the new rep',r.status===200);
  ok('  the rep card is active and the approval is recorded',(await a.from('reps').select('active').eq('id',nrep.id).single()).data.active===true&&(await a.from('rep_invites').select('approved_by').eq('id',inv.j.invite.id).single()).data.approved_by===adm.email);
  r=await call('POST',`/api/admin/rep-invites/${inv.j.invite.id}/approve`,ac); ok('  approving twice is refused',r.status===409);
  const nc2=await session(e1);
  const page2=await (await fetch('http://localhost:10001/rep',{headers:{Cookie:nc2}})).text(); ok('  now the sales portal opens',!page2.includes('waiting for RIVIX to approve'));
  r=await call('GET','/api/replications',nc2); ok('  and rep APIs work',r.status===200,r.status);

  // --- expired and cancelled links
  const e2=`zz-inv-new2-${t}@yopmail.com`; newEmails.push(e2); const inv2=await invite(ac,e2);
  await a.from('rep_invites').update({expires_at:new Date(Date.now()-60e3).toISOString()}).eq('id',inv2.j.invite.id);
  r=await call('GET',`/api/rep-invites/${inv2.token}`,null); ok('an expired link does not open',r.status===404);
  r=await call('POST',`/api/rep-invites/${inv2.token}`,null,{name:'ZZ Late',password:'New-pass-12345'}); ok('an expired link cannot sign up',r.status===404&&((await a.from('reps').select('id').eq('email',e2)).data||[]).length===0);
  const e3=`zz-inv-new3-${t}@yopmail.com`; newEmails.push(e3); const inv3=await invite(ac,e3);
  r=await call('POST',`/api/admin/rep-invites/${inv3.j.invite.id}/cancel`,rc); ok('a rep cannot cancel an invite',r.status===401||r.status===403);
  r=await call('POST',`/api/admin/rep-invites/${inv3.j.invite.id}/cancel`,ac); ok('a two-step admin cancels an invite',r.status===200);
  r=await call('GET',`/api/rep-invites/${inv3.token}`,null); ok('a cancelled link does not open',r.status===404);
  r=await call('POST',`/api/rep-invites/${inv3.token}`,null,{name:'ZZ Cancelled',password:'New-pass-12345'}); ok('a cancelled link cannot sign up',r.status===404);
  r=await call('GET','/api/admin/rep-invites',ac); j=await r.json(); const st=Object.fromEntries((j.invites||[]).map(x=>[x.email,x.status]));
  ok('the invites list shows each state',st[e1]==='approved'&&st[e2]==='expired'&&st[e3]==='cancelled',JSON.stringify([st[e1],st[e2],st[e3]]));

  // --- two sign-ups on one link at the same moment: exactly one account
  const e4=`zz-inv-new4-${t}@yopmail.com`; newEmails.push(e4); const inv4=await invite(ac,e4);
  const both=await Promise.all([1,2].map(n=>call('POST',`/api/rep-invites/${inv4.token}`,null,{name:`ZZ Race ${n}`,password:'New-pass-12345'})));
  const codes=both.map(x=>x.status).sort();
  ok('two sign-ups at once: one succeeds, the other is refused',codes[0]===201&&codes[1]===404,JSON.stringify(codes));
  ok('  exactly one rep card exists for that email',((await a.from('reps').select('id').eq('email',e4)).data||[]).length===1);
  // switching a pending rep on from the rep edit form counts as approval
  const r4=(await a.from('reps').select('id').eq('email',e4).single()).data;
  r=await call('PATCH',`/api/admin/reps/${r4.id}`,ac,{active:true}); ok('enabling a signed-up rep on the Team page also records the approval',r.status===200&&!!(await a.from('rep_invites').select('approved_at').eq('id',inv4.j.invite.id).single()).data.approved_at);

  // --- rate limit: 10 attempts per IP per 15 minutes on the public routes
  const codesRL=[]; for(let i=0;i<11;i++){ const x=await call('GET',`/api/rep-invites/${'A'.repeat(43)}`,null,null,OTHER_IP); codesRL.push(x.status); }
  ok('the first 10 attempts from one IP are answered, the 11th gets 429',codesRL.slice(0,10).every(s=>s===404)&&codesRL[10]===429,JSON.stringify(codesRL));
  r=await call('POST',`/api/rep-invites/${'A'.repeat(43)}`,null,{name:'x',password:'New-pass-12345'},OTHER_IP); ok('  sign-up is limited too',r.status===429);
  r=await fetch(`http://localhost:10001/api/rep-invites/${'A'.repeat(43)}`,{headers:{'x-real-ip':freshIp(),'x-forwarded-for':OTHER_IP}}); ok('  a client-sent x-forwarded-for is not trusted as the caller IP',r.status===404,r.status);
  const pageJoin=await fetch(`http://localhost:10001/join/${inv.token}`); ok('the join page itself loads without signing in',pageJoin.status===200);
}catch(e){console.log('ERROR',e)}finally{
  const {data:{users:all}}=await a.auth.admin.listUsers({page:1,perPage:1000});
  const made=all.filter(u=>newEmails.includes(u.email));
  await a.from('rep_invites').delete().in('email',newEmails);
  await a.from('reps').delete().in('email',newEmails);
  await a.from('notifications').delete().eq('kind','rep_signup').ilike('title','%ZZ%');
  await a.from('rep_signup_attempts').delete().gte('created_at',started);
  await a.from('customers').delete().eq('id',c.id); await a.from('reps').delete().eq('id',rep.id);
  for(const u of [adm,ru,cu,...made]) await a.auth.admin.deleteUser(u.id); console.log('cleaned');
}
