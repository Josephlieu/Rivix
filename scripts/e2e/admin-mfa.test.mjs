// Task 8: admin two-step sign-in. A password-only admin session gets 401 from admin APIs and is sent to the two-step
// page by /admin pages; only after the authenticator code (aal2) does the admin get in. Another admin can reset a
// locked-out admin's two-step: the authenticator is removed, they are signed out, emailed (dry run) and every admin is
// alerted. Run on DEV only, with `EMAIL_DRY_RUN=1 npm run dev` running:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/admin-mfa.test.mjs
// Creates throwaway 'zz-' accounts and removes them at the end.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
import { enrollTotp, totp } from './mfa.mjs';
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x);

// --- the reset email (pure)
const { mfaResetEmail } = await import('../../src/lib/admin-mfa-emails.ts');
let m=mfaResetEmail({to:'lost@example.com',by:'boss@example.com',at:new Date('2026-11-10T18:30:00Z')});
ok('the reset email goes to the affected admin and names who did it and when',m.to==='lost@example.com'&&/reset by boss@example\.com at Nov 10, 2026/.test(m.text),m.text.split('\n')[0]);
ok("it says to contact RIVIX if they didn't ask for it",/If you didn't ask for this, contact RIVIX now\./.test(m.text)&&/<html/.test(m.html));

const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const a=createClient(U,(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY),{auth:{persistSession:false}});
const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,x)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(x?{app_metadata:x}:{})})).data.user;
const ad1=await mk(`zz-mfa-a1-${t}@yopmail.com`,{role:'admin'}), ad2=await mk(`zz-mfa-a2-${t}@yopmail.com`,{role:'admin'}), ru=await mk(`zz-mfa-r-${t}@yopmail.com`,{role:'rep'}), cu=await mk(`zz-mfa-c-${t}@yopmail.com`);
const {data:rep}=await a.from('reps').insert({name:'ZZ MFA Rep',email:ru.email,user_id:ru.id}).select().single();
const {data:c}=await a.from('customers').insert({user_id:cu.id,company_name:'ZZ MFA Co',contact_email:cu.email,customer_code:'',rep_id:rep.id}).select().single();
const {data:o}=await a.from('orders').insert({customer_id:c.id,rep_id:rep.id,batch_number:'',product_name:'MFA test',quantity:1}).select().single();
// A cookie-backed session (like the browser). `then` runs extra steps on the same session (e.g. the two-step).
const session=async(email,then)=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const x=await sb.auth.signInWithPassword({email,password:pw});if(x.error)throw x.error;const extra=then?await then(sb):null;return {sb,extra,cookie:()=>[...j].map(([k,v])=>`${k}=${v}`).join('; ')};};
const call=(m,url,ck,body)=>fetch('http://localhost:10001'+url,{method:m,headers:{'Content-Type':'application/json',...(ck?{Cookie:ck}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
const adminApis=[['GET','/api/admin/orders'],['GET','/api/admin/customers'],['GET',`/api/admin/orders/${o.id}`],['PATCH',`/api/admin/orders/${o.id}`,{status:'Shipped'}],['GET','/api/admin/product-specs'],['GET','/api/admin/reps'],['GET','/api/admin/admins'],['POST','/api/admin/orders/import',{rows:[{a:1}],dryRun:true}],['GET','/api/replications'],['POST','/api/analyze-garment',{replicationId:'x1'}],['POST',`/api/admin/admins/${ad2.id}/reset-mfa`]];
try{
  // --- 1. a password-only admin (no authenticator yet)
  const p1=await session(ad1.email); const pc=p1.cookie();
  for(const [mt,url,body] of adminApis){ const r=await call(mt,url,pc,body); ok(`password-only admin: ${mt} ${url} -> 401`,r.status===401,r.status); }
  let r=await call('GET','/api/admin/orders',pc); let j=await r.json(); ok('  the 401 says two-step sign-in is required',j.code==='mfa_required'&&/two-step/i.test(j.error),j.error);
  r=await call('PATCH',`/api/admin/orders/${o.id}`,pc,{status:'Shipped'}); ok('  and nothing was changed',(await a.from('orders').select('status').eq('id',o.id).single()).data.status!=='Shipped');
  r=await call('PATCH',`/api/order-requests/00000000-0000-0000-0000-000000000000`,pc,{action:'decline',reason:'x'}); ok('  the order request route also refuses a password-only admin',r.status===401);
  r=await call('GET','/admin',pc); ok('/admin sends an admin without an authenticator to the set-up page',r.status>=300&&r.status<400&&/\/admin-mfa\?next=%2Fadmin/.test(r.headers.get('location')||''),r.headers.get('location'));
  r=await call('GET','/admin/orders',pc); ok('  every admin page does',r.status>=300&&r.status<400&&/\/admin-mfa/.test(r.headers.get('location')||''));
  r=await call('GET','/admin-mfa?next=/admin',pc); ok('the two-step page itself loads',r.status===200);

  // --- 2. straight to the database with a password-only admin session (rows of a customer they are not)
  const own=p1.sb;
  const reads={};
  for(const tb of ['customers','orders','order_items','documents','replications','notifications']){ const d=await own.from(tb).select('id').limit(5); reads[tb]=d.error?'error':(d.data||[]).length; }
  const leaked=Object.entries(reads).filter(([tb,n])=>typeof n==='number'&&n>0&&tb!=='notifications');
  ok('a password-only admin cannot read customer data straight from the database',leaked.length===0,JSON.stringify(reads));

  // --- 3. set up the authenticator: now trusted
  const {factorId,secret}=await enrollTotp(own);
  const pc2=p1.cookie();
  r=await call('GET','/api/admin/orders',pc2); ok('after the code (aal2) the same admin gets in',r.status===200,r.status);
  r=await call('GET','/admin',pc2); ok('  and /admin opens',r.status===200,r.status);
  // a new password-only session, now that an authenticator exists
  const p2=await session(ad1.email); const pc3=p2.cookie();
  r=await call('GET','/api/admin/orders',pc3); ok('a new password-only session is refused again (401)',r.status===401);
  r=await call('GET','/admin',pc3); ok('  and /admin asks for the code',r.status>=300&&r.status<400&&/\/admin-mfa/.test(r.headers.get('location')||''));
  const ch=await p2.sb.auth.mfa.challenge({factorId}); const bad=await p2.sb.auth.mfa.verify({factorId,challengeId:ch.data.id,code:totp(secret)==='000000'?'111111':'000000'});
  ok('a wrong code is refused',!!bad.error);
  r=await call('GET','/api/admin/orders',p2.cookie()); ok('  and the session stays untrusted',r.status===401);
  const ch2=await p2.sb.auth.mfa.challenge({factorId}); const good=await p2.sb.auth.mfa.verify({factorId,challengeId:ch2.data.id,code:totp(secret)});
  r=await call('GET','/api/admin/orders',p2.cookie()); ok('the right code makes it trusted',!good.error&&r.status===200,good.error?.message||r.status);

  // --- 4. reset by another admin
  const a2=await session(ad2.email,sb=>enrollTotp(sb)); const ac2=a2.cookie();
  const a1=p2; const ac1=a1.cookie();
  r=await call('GET','/api/admin/admins',ac2); j=await r.json(); const row1=j.admins?.find(x=>x.id===ad1.id), me=j.admins?.find(x=>x.id===ad2.id);
  ok('the Team page lists admins with their two-step state',r.status===200&&row1?.twoStep===true&&me?.isYou===true&&!j.admins.some(x=>x.id===ru.id));
  r=await call('POST',`/api/admin/admins/${ad2.id}/reset-mfa`,ac2); ok('an admin cannot reset their own two-step',r.status===400);
  r=await call('POST',`/api/admin/admins/${ru.id}/reset-mfa`,ac2); ok('a non-admin account cannot be "reset" through this',r.status===404);
  const repS=await session(ru.email), cusS=await session(cu.email);
  for(const [n,ck] of [['rep',repS.cookie()],['customer',cusS.cookie()],['signed-out',null]]){ r=await call('POST',`/api/admin/admins/${ad1.id}/reset-mfa`,ck); ok(`a ${n} cannot reset anyone`,r.status===401||r.status===403); }
  // the sign-out function (task-08-revoke-user-sessions.sql) is for the server only
  for(const [n,client] of [['the public key',createClient(U,A,{auth:{persistSession:false}})],['a signed-in rep',repS.sb],['a trusted admin (from the browser)',a2.sb]]){
    const x=await client.rpc('revoke_user_sessions',{target:ru.id});
    ok(`${n} cannot call revoke_user_sessions`,!!x.error,x.error?.code||'no error');
  }
  r=await call('GET','/api/replications',repS.cookie()); ok("  and the rep's session still works (those attempts ended nothing)",r.status===200,r.status);
  ok('  admin 1 still has their authenticator',((await a.auth.admin.mfa.listFactors({userId:ad1.id})).data?.factors||[]).length===1);
  r=await call('POST',`/api/admin/admins/${ad1.id}/reset-mfa`,ac2); j=await r.json();
  ok('another admin resets admin 1',r.status===200&&j.removed===1,j.error||'');
  if(j.email==='sent'){ console.log('FAIL the dev server is NOT in dry run (EMAIL_DRY_RUN=1)'); }
  ok('  admin 1 is emailed (dry run)',j.email==='dry_run'&&j.emailWarning===undefined,String(j.email)+' '+(j.emailWarning||''));
  ok('  the authenticator is gone',((await a.auth.admin.mfa.listFactors({userId:ad1.id})).data?.factors||[]).length===0);
  ok('  admin 1 was signed out of every session',j.signedOut===true);
  r=await call('GET','/api/admin/orders',ac1); ok("  admin 1's old trusted session no longer works",r.status===401,r.status);
  const {data:alerts}=await a.from('notifications').select('recipient_user_id,body,created_at').eq('kind','admin_mfa_reset').ilike('title',`%${ad1.email}%`);
  ok('  every admin gets an in-app alert naming who did it',alerts?.some(x=>x.recipient_user_id===ad1.id)&&alerts?.some(x=>x.recipient_user_id===ad2.id)&&alerts.every(x=>x.body.includes(ad2.email)));
  const p3=await session(ad1.email); r=await call('GET','/admin',p3.cookie());
  ok('at the next sign-in admin 1 is sent to set up a new authenticator',r.status>=300&&r.status<400&&/\/admin-mfa/.test(r.headers.get('location')||'')&&!((await a.auth.admin.getUserById(ad1.id)).data.user.factors||[]).some(f=>f.status==='verified'));
}catch(e){console.log('ERROR',e)}finally{
  await a.from('notifications').delete().eq('kind','admin_mfa_reset').ilike('title','%zz-mfa-%');
  await a.from('orders').delete().eq('customer_id',c.id); await a.from('customers').delete().eq('id',c.id); await a.from('reps').delete().eq('id',rep.id);
  for(const u of [ad1,ad2,ru,cu]) await a.auth.admin.deleteUser(u.id); console.log('cleaned');
}
