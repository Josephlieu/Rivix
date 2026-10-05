// End-to-end test (dev database + running dev server). Run from the project root: node scripts/e2e/welcome.test.mjs
// Creates throwaway 'zz-' accounts and removes them at the end. Needs `npm run dev` running and .env.local.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module'; const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x); const pw='Tmp-pass-9876!',t=Date.now();
const adm=(await a.auth.admin.createUser({email:`zz-wa-${t}@yopmail.com`,password:pw,email_confirm:true,app_metadata:{role:'admin'}})).data.user;
const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});await sb.auth.signInWithPassword({email:adm.email,password:pw});
const ck=[...j].map(([k,v])=>`${k}=${v}`).join('; ');
const call=(m,url,body)=>fetch('http://localhost:10001'+url,{method:m,headers:{'Content-Type':'application/json',Cookie:ck},body:body?JSON.stringify(body):undefined});
const notifs=async e=>{const {data:l}=await a.auth.admin.listUsers({perPage:1000});const u=l.users.find(x=>x.email===e);if(!u)return null;return (await a.from('notifications').select('*').eq('recipient_user_id',u.id)).data};
let repId,custId,repE=`zz-wr-${t}@yopmail.com`,custE=`zz-wc-${t}@yopmail.com`;
try{
  let r=await call('POST','/api/admin/reps',{name:'ZZ Welcome Rep',email:repE,create_login:true}); let d=await r.json(); repId=d.rep?.id;
  ok('rep created with a login',r.status===201&&d.credentials);
  let n=await notifs(repE); ok('new rep has a welcome message waiting, linking to their customers',n?.length===1&&n[0].kind==='welcome'&&n[0].link==='/rep/customers'&&!n[0].read_at,JSON.stringify(n?.map(x=>x.title)));
  r=await call('POST',`/api/admin/reps/${repId}/login`); n=await notifs(repE); ok('resetting the rep password does NOT send another welcome',n.length===1);
  r=await call('POST','/api/admin/customers',{company_name:'ZZ Welcome Cust',email:custE}); d=await r.json(); custId=d.customer?.id; ok('customer created',r.status===201);
  n=await notifs(custE); ok('new customer has a welcome message linking to their orders',n?.length===1&&n[0].kind==='welcome'&&n[0].link==='/portal/orders',JSON.stringify(n?.map(x=>x.title)));
  r=await call('POST',`/api/admin/customers/${custId}/login`); n=await notifs(custE); ok('customer password reset sends no second welcome',n.length===1);
  r=await call('POST','/api/admin/reps',{name:'ZZ No Login Rep',email:`zz-nl-${t}@yopmail.com`}); d=await r.json(); const nlId=d.rep?.id; ok('a rep without a login gets none (nobody to tell yet)',(await notifs(`zz-nl-${t}@yopmail.com`))===null); if(nlId) await a.from('reps').delete().eq('id',nlId);
}catch(e){console.log('ERROR',e)}finally{
  if(custId){await a.from('customers').delete().eq('id',custId);} if(repId){await a.from('reps').delete().eq('id',repId);}
  const {data:l}=await a.auth.admin.listUsers({perPage:1000}); for(const u of l.users) if((u.email||'').startsWith('zz-')) await a.auth.admin.deleteUser(u.id);
  const {data:lc}=await a.from('customers').select('id').like('company_name','ZZ %'); const {data:lr}=await a.from('reps').select('id').like('name','ZZ %'); const {data:l2}=await a.auth.admin.listUsers({perPage:1000});
  console.log('cleaned; leftovers — customers:',lc.length,'reps:',lr.length,'users:',l2.users.filter(u=>(u.email||'').startsWith('zz-')).length);
}
