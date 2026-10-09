// End-to-end test (dev database + running dev server). Run from the project root: node scripts/e2e/assignment.test.mjs
// Creates throwaway 'zz-' accounts and removes them at the end. Needs `npm run dev` running and .env.local.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module'; const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x); const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,m)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(m?{app_metadata:m}:{})})).data.user;
const adm=await mk(`zz-aa-${t}@yopmail.com`,{role:'admin'}), r1=await mk(`zz-ar1-${t}@yopmail.com`,{role:'rep'}), r2=await mk(`zz-ar2-${t}@yopmail.com`,{role:'rep'}), cu=await mk(`zz-ac-${t}@yopmail.com`);
const {data:rep1}=await a.from('reps').insert({name:'ZZ A1',email:r1.email,user_id:r1.id}).select().single();
const {data:rep2}=await a.from('reps').insert({name:'ZZ A2',email:r2.email,user_id:r2.id}).select().single();
const {data:c}=await a.from('customers').insert({user_id:cu.id,company_name:'ZZ Assign Co',contact_email:cu.email,customer_code:''}).select().single();
const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});await sb.auth.signInWithPassword({email:adm.email,password:pw});
const ck=[...j].map(([k,v])=>`${k}=${v}`).join('; ');
const patch=(rep_id)=>fetch(`http://localhost:10001/api/admin/customers/${c.id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Cookie:ck},body:JSON.stringify({rep_id})});
const n=async uid=>(await a.from('notifications').select('*').eq('recipient_user_id',uid)).data;
try{
  let r=await patch(rep1.id); ok('assign to rep 1',r.status===200);
  let x=(await n(r1.id)).find(q=>q.kind==='customer_assigned'); ok('rep 1 told a customer was assigned, link opens that customer',x&&x.title.includes('ZZ Assign Co')&&x.link===`/rep/customers/${c.id}`,x?.title);
  let y=(await n(cu.id)).find(q=>q.kind==='rep_changed'); ok('customer told who their rep is',y&&y.title.includes('ZZ A1'),y?.title);
  r=await patch(rep1.id); ok('same rep again sends nothing new',(await n(r1.id)).filter(q=>q.kind==='customer_assigned').length===1);
  r=await patch(rep2.id); ok('reassign to rep 2',r.status===200);
  ok('rep 2 told',(await n(r2.id)).some(q=>q.kind==='customer_assigned'));
  x=(await n(r1.id)).find(q=>q.kind==='customer_unassigned'); ok('rep 1 told the customer moved, and to whom',x&&x.body.includes('ZZ A2'),x?.body);
  ok('customer told about the new rep',(await n(cu.id)).some(q=>q.kind==='rep_changed'&&q.title.includes('ZZ A2')));
  r=await patch(null); ok('unassign',r.status===200); ok('rep 2 told they lost the customer',(await n(r2.id)).some(q=>q.kind==='customer_unassigned'));
  // new customer created with a rep chosen
  r=await fetch('http://localhost:10001/api/admin/customers',{method:'POST',headers:{'Content-Type':'application/json',Cookie:ck},body:JSON.stringify({company_name:'ZZ Brand New',email:`zz-an-${t}@yopmail.com`,rep_id:rep1.id})}); const d=await r.json();
  ok('creating a client with a rep chosen tells that rep',r.status===201&&(await n(r1.id)).some(q=>q.kind==='customer_assigned'&&q.title.includes('ZZ Brand New')));
  if(d.customer?.id) await a.from('customers').delete().eq('id',d.customer.id);
}catch(e){console.log('ERROR',e)}finally{
  await a.from('customers').delete().eq('id',c.id); await a.from('reps').delete().in('id',[rep1.id,rep2.id]);
  const {data:l}=await a.auth.admin.listUsers({perPage:1000}); for(const u of l.users) if((u.email||'').startsWith('zz-')) await a.auth.admin.deleteUser(u.id);
  const {data:lc}=await a.from('customers').select('id').like('company_name','ZZ %'); const {data:lr}=await a.from('reps').select('id').like('name','ZZ %'); const {data:l2}=await a.auth.admin.listUsers({perPage:1000});
  console.log('cleaned; leftovers — customers:',lc.length,'reps:',lr.length,'users:',l2.users.filter(u=>(u.email||'').startsWith('zz-')).length);
}
