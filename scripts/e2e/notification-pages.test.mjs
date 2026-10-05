// End-to-end test (dev database + running dev server). Run from the project root: node scripts/e2e/notification-pages.test.mjs
// Creates throwaway 'zz-' accounts and removes them at the end. Needs `npm run dev` running and .env.local.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module'; const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x); const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,m)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(m?{app_metadata:m}:{})})).data.user;
const adm=await mk(`zz-pa-${t}@yopmail.com`,{role:'admin'}), r1=await mk(`zz-pr-${t}@yopmail.com`,{role:'rep'}), cu=await mk(`zz-pc-${t}@yopmail.com`);
const {data:rep}=await a.from('reps').insert({name:'ZZ P',email:r1.email,user_id:r1.id}).select().single();
const {data:c}=await a.from('customers').insert({user_id:cu.id,company_name:'ZZ Pages',contact_email:cu.email,customer_code:'',rep_id:rep.id}).select().single();
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});await sb.auth.signInWithPassword({email:e,password:pw});return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const get=(p,ck)=>fetch('http://localhost:10001'+p,{headers:ck?{Cookie:ck}:{},redirect:'manual'});
try{
  const ac=await cookie(adm.email), rc=await cookie(r1.email), cc=await cookie(cu.email);
  ok('admin notifications page',(await get('/admin/notifications',ac)).status===200);
  ok('rep notifications page',(await get('/rep/notifications',rc)).status===200);
  ok('customer notifications page',(await get('/portal/notifications',cc)).status===200);
  const x=await get('/admin/notifications',cc); ok("customer can't open the admin page (sent away)",x.status>=300&&x.status<400);
  const y=await get('/admin/notifications',rc); ok("rep can't open the admin page (sent away)",y.status>=300&&y.status<400);
  const z=await get('/portal/notifications',null); ok('signed-out sent to login',z.status>=300&&z.status<400);
  // 35 notifications to check paging + ordering in the data
  await a.from('notifications').insert(Array.from({length:35},(_,i)=>({recipient_user_id:cu.id,kind:'welcome',title:`Test ${i+1}`,created_at:new Date(Date.now()-i*60000).toISOString()})));
  const s=createClient(U,A,{auth:{persistSession:false}}); await s.auth.signInWithPassword({email:cu.email,password:pw});
  const p1=await s.from('notifications').select('title').order('created_at',{ascending:false}).range(0,29); const p2=await s.from('notifications').select('title').order('created_at',{ascending:false}).range(30,59);
  ok('paging: 30 then 5, newest first',p1.data.length===30&&p2.data.length===5&&p1.data[0].title==='Test 1'&&p2.data[4].title==='Test 35');
  const un=await s.from('notifications').select('id').is('read_at',null); ok('unread filter returns them all',un.data.length===35);
}catch(e){console.log('ERROR',e)}finally{
  await a.from('customers').delete().eq('id',c.id); await a.from('reps').delete().eq('id',rep.id);
  const {data:l}=await a.auth.admin.listUsers({perPage:1000}); for(const u of l.users) if((u.email||'').startsWith('zz-')) await a.auth.admin.deleteUser(u.id);
  const {data:lc}=await a.from('customers').select('id').like('company_name','ZZ %'); const {data:l2}=await a.auth.admin.listUsers({perPage:1000});
  console.log('cleaned; leftovers — customers:',lc.length,'users:',l2.users.filter(u=>(u.email||'').startsWith('zz-')).length);
}
