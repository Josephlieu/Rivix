// Checks document expiry dates and badges: the date rules, and that only an admin can set or change the date.
// Run on DEV only, after running audit-docs/deliverables/task-02-document-expiry.sql, with `npm run dev` running:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/document-expiry.test.mjs
// Creates throwaway 'zz-' accounts and removes them at the end. (The badge itself is drawn in the browser; this checks
// the logic behind it and the saved data.)
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
import { stepUp } from './mfa.mjs'; // task 8: admin sessions need the two-step sign-in
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x);

// --- the badge rules (pure)
const { documentExpiry, parseExpiryDate, EXPIRY_WARNING_DAYS } = await import('../../src/lib/documents.ts');
const T='2026-11-08';
const addDays=(key,n)=>{const [y,m,d]=key.split('-').map(Number);return new Date(Date.UTC(y,m-1,d+n)).toISOString().slice(0,10);};
ok('the warning window is 30 days',EXPIRY_WARNING_DAYS===30);
ok('yesterday = Expired (red)',documentExpiry(addDays(T,-1),T)?.kind==='expired'&&documentExpiry(addDays(T,-1),T).label==='Expired');
ok('a year ago = Expired',documentExpiry(addDays(T,-365),T)?.kind==='expired');
ok('today = Expires today (amber)',documentExpiry(T,T)?.kind==='soon'&&documentExpiry(T,T).label==='Expires today');
ok('tomorrow = Expires in 1 day',documentExpiry(addDays(T,1),T)?.label==='Expires in 1 day');
ok('in 30 days = amber, "Expires in 30 days"',documentExpiry(addDays(T,30),T)?.label==='Expires in 30 days');
ok('in 31 days = no badge',documentExpiry(addDays(T,31),T)===null);
ok('far future = no badge',documentExpiry('2030-01-01',T)===null);
ok('no date = no badge',documentExpiry(null,T)===null&&documentExpiry(undefined,T)===null&&documentExpiry('',T)===null);
ok('counts across a month and year end',documentExpiry('2027-01-02','2026-12-30')?.label==='Expires in 3 days');
ok('a good date is accepted',JSON.stringify(parseExpiryDate('2027-02-28'))===JSON.stringify({ok:true,value:'2027-02-28'}));
ok('empty or null clears the date',parseExpiryDate('').ok&&parseExpiryDate('').value===null&&parseExpiryDate(null).value===null);
ok('impossible or wrongly written dates are rejected',['2026-02-30','2026-13-01','03/10/2026','abc','2026-1-5',20261108].every(v=>parseExpiryDate(v).ok===false));

// --- the routes (dev server + dev database)
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const a=createClient(U,(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY),{auth:{persistSession:false}});
const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,x)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(x?{app_metadata:x}:{})})).data.user;
const adm=await mk(`zz-dx-a-${t}@yopmail.com`,{role:'admin'}), ru=await mk(`zz-dx-r-${t}@yopmail.com`,{role:'rep'}), cu=await mk(`zz-dx-c-${t}@yopmail.com`);
const {data:rep}=await a.from('reps').insert({name:'ZZ DX Rep',email:ru.email,user_id:ru.id}).select().single();
const {data:c}=await a.from('customers').insert({user_id:cu.id,company_name:'ZZ Expiry Co',contact_email:cu.email,customer_code:'',rep_id:rep.id}).select().single();
const {data:o}=await a.from('orders').insert({customer_id:c.id,rep_id:rep.id,batch_number:'',product_name:'Expiry test',quantity:1}).select().single();
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const r=await sb.auth.signInWithPassword({email:e,password:pw});if(r.error)throw r.error;await stepUp(sb);return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(m,url,ck,body)=>fetch('http://localhost:10001'+url,{method:m,headers:{'Content-Type':'application/json',...(ck?{Cookie:ck}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
const sbAnon=createClient(U,A,{auth:{persistSession:false}});
const paths=[];
// Upload a small PDF the way the admin page does, then record it with the given expiry date.
const upload=async(ck,expires_on,title)=>{
  const content=Buffer.from('%PDF-1.4 expiry test '+title+t);
  const r1=await call('POST',`/api/admin/orders/${o.id}/documents/upload-url`,ck,{file_name:`${title}.pdf`,size:content.length,mime:'application/pdf'}); const j1=await r1.json();
  paths.push(j1.path);
  await sbAnon.storage.from('documents').uploadToSignedUrl(j1.path,j1.token,content,{contentType:'application/pdf'});
  return call('POST',`/api/admin/orders/${o.id}/documents`,ck,{path:j1.path,file_name:`${title}.pdf`,title,doc_type:'CSA Certificate',expires_on});
};
const row=async id=>(await a.from('documents').select('expires_on').eq('id',id).maybeSingle()).data;
try{
  const ac=await cookie(adm.email), rc=await cookie(ru.email), cc=await cookie(cu.email);
  let r=await upload(ac,'2027-03-15','Cert with expiry'); let j=await r.json();
  ok('admin uploads a document with an expiry date',r.status===201&&(await row(j.id))?.expires_on==='2027-03-15',j.error||'');
  const docId=j.id;
  r=await upload(ac,null,'Cert without expiry'); j=await r.json(); ok('a document can have no expiry date',r.status===201&&(await row(j.id))?.expires_on===null);
  const before=(await a.from('documents').select('id').eq('order_id',o.id)).data.length;
  r=await upload(ac,'2026-02-30','Bad date'); ok('an impossible date on upload is rejected',r.status===400);
  ok('  and no record is saved',(await a.from('documents').select('id').eq('order_id',o.id)).data.length===before);
  ok('  and the uploaded file is removed',!!(await a.storage.from('documents').download(paths.at(-1))).error);

  r=await call('PATCH',`/api/admin/documents/${docId}`,ac,{expires_on:'2026-12-01'}); ok('admin changes the expiry date',r.status===200&&(await row(docId)).expires_on==='2026-12-01');
  r=await call('PATCH',`/api/admin/documents/${docId}`,ac,{expires_on:'01/12/2026'}); ok('a wrongly written date is rejected',r.status===400&&(await row(docId)).expires_on==='2026-12-01');
  r=await call('PATCH',`/api/admin/documents/${docId}`,ac,{title:'renamed'}); ok('a request without expires_on is rejected',r.status===400);
  r=await call('PATCH',`/api/admin/documents/00000000-0000-0000-0000-000000000000`,ac,{expires_on:'2026-12-01'}); ok('unknown document = 404',r.status===404);
  for(const [n,ck] of [['rep',rc],['customer',cc],['signed-out',null]]){
    r=await call('PATCH',`/api/admin/documents/${docId}`,ck,{expires_on:'2099-01-01'}); ok(`${n} cannot change the expiry date`,(r.status===401||r.status>=300)&&(await row(docId)).expires_on==='2026-12-01');
  }
  const sc=createClient(U,A,{auth:{persistSession:false}}); await sc.auth.signInWithPassword({email:cu.email,password:pw});
  await sc.from('documents').update({expires_on:'2099-01-01'}).eq('id',docId);
  ok('a customer cannot change the date straight through the database',(await row(docId)).expires_on==='2026-12-01');
  const own=await sc.from('documents').select('id, expires_on').eq('id',docId).single(); ok('the customer can read the date (for the badge)',own.data?.expires_on==='2026-12-01');

  const ad=await call('GET',`/api/admin/orders/${o.id}`,ac); const adj=await ad.json(); ok('admin order data includes the expiry date',adj.documents?.some(d=>d.id===docId&&d.expires_on==='2026-12-01'));
  const rp=await fetch(`http://localhost:10001/rep/orders/${o.id}`,{headers:{Cookie:rc}}); const rh=await rp.text(); ok('rep order page gets the expiry date',rp.status===200&&rh.includes('2026-12-01'));
  const cp=await fetch(`http://localhost:10001/portal/certificates`,{headers:{Cookie:cc}}); ok('customer Documents page loads',cp.status===200);

  r=await call('PATCH',`/api/admin/documents/${docId}`,ac,{expires_on:null}); ok('admin removes the expiry date',r.status===200&&(await row(docId)).expires_on===null);
}catch(e){console.log('ERROR',e)}finally{
  if(paths.length) await a.storage.from('documents').remove(paths);
  await a.from('documents').delete().eq('order_id',o.id);
  await a.from('orders').delete().eq('customer_id',c.id); await a.from('customers').delete().eq('id',c.id); await a.from('reps').delete().eq('id',rep.id);
  for(const u of [adm,ru,cu]) await a.auth.admin.deleteUser(u.id); console.log('cleaned');
}
