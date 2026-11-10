// End-to-end test (dev database + running dev server). Run from the project root: node scripts/e2e/team-reps.test.mjs
// Team tab counts and the Rep Detail page. Creates throwaway 'zz-' accounts and 'ZZ' rows and removes them at the end.
// Needs `npm run dev` running and .env.local. The territory checks need audit-docs/deliverables/dev-patch-rep-territory.sql.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module'; const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
import fs from 'fs';
import { stepUp } from './mfa.mjs'; // task 8: admin sessions need the two-step sign-in
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x); const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,m)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(m?{app_metadata:m}:{})})).data.user;
const adm=await mk(`zz-ta-${t}@yopmail.com`,{role:'admin'}), cu=await mk(`zz-tc-${t}@yopmail.com`);
const {data:rep}=await a.from('reps').insert({name:'ZZ Team Rep',email:`zz-tr-${t}@yopmail.com`}).select().single();
const {data:c}=await a.from('customers').insert({user_id:cu.id,company_name:'ZZ Team Co',contact_email:cu.email,customer_code:'',rep_id:rep.id}).select().single();
const mkOrder=async(status)=>(await a.from('orders').insert({customer_id:c.id,rep_id:rep.id,batch_number:'',product_name:'Team test',quantity:1,...(status?{status}:{})}).select().single()).data;
const done=await mkOrder('Delivered'), open=await mkOrder();
await a.from('document_requests').insert({order_id:done.id,customer_id:c.id,rep_id:rep.id,doc_type:'Certificate',status:'open'});
const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});await sb.auth.signInWithPassword({email:adm.email,password:pw});await stepUp(sb);
const ck=[...j].map(([k,v])=>`${k}=${v}`).join('; ');
const call=(m,url,body,cookie=ck)=>fetch('http://localhost:10001'+url,{method:m,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
try{
  // Real actions through the API: each one must land in the rep's history (needs dev-patch-rep-activity.sql and -2.sql).
  await call('PATCH',`/api/admin/orders/${open.id}`,{status:'Shipped'});
  await call('POST',`/api/admin/orders/${open.id}/notes`,{note:'ZZ team note',customer_visible:false});
  const rq=(await a.from('document_requests').select('id').eq('order_id',done.id).single()).data;
  await call('PATCH',`/api/admin/document-requests/${rq.id}`);
  let r=await call('GET','/api/admin/reps'); let d=await r.json(); const row=(d.reps||[]).find(x=>x.id===rep.id);
  ok('team list loads',r.status===200&&!!row);
  ok('team list: customers assigned = 1',row?.customer_count===1,row?.customer_count);
  ok('team list: orders completed = 1 (Delivered only)',row?.orders_completed===1,row?.orders_completed);
  ok('team list: requests = 1',row?.request_count===1,row?.request_count);
  ok('team list hides user_id',row&&!('user_id' in row));

  r=await call('GET',`/api/admin/reps/${rep.id}`); d=await r.json();
  ok('rep detail loads',r.status===200&&d.rep?.id===rep.id,r.status);
  ok('rep detail stats',d.stats?.customers===1&&d.stats?.orders_total===2&&d.stats?.orders_completed===1&&d.stats?.orders_in_progress===1&&d.stats?.requests===1,JSON.stringify(d.stats));
  ok('rep detail lists the customer',d.customers?.length===1&&d.customers[0].company_name==='ZZ Team Co');
  ok('rep detail lists both orders',d.orders?.length===2);
  const labels=(d.activity||[]).map(x=>x.label);
  ok('history is read from the log (log_ready)',d.log_ready===true,d.log_ready);
  ok('history: status change by the admin',(d.activity||[]).some(x=>x.label.includes('moved to Shipped')&&(x.by||'').startsWith('zz-ta-')),labels.join(' | '));
  ok('history: internal note',labels.some(l=>l.startsWith('Note on')&&l.includes('(internal)')&&l.includes('ZZ team note')),labels.join(' | '));
  ok('history: document request marked done',labels.some(l=>l.includes('Certificate request')&&l.includes('marked done')),labels.join(' | '));
  ok('activity newest first',(d.activity||[]).every((x,i,arr)=>i===0||arr[i-1].at>=x.at));
  ok('rep detail hides user_id',d.rep&&!('user_id' in d.rep));

  r=await call('GET','/api/admin/reps/00000000-0000-0000-0000-000000000000'); ok('unknown rep -> 404',r.status===404,r.status);
  r=await call('GET',`/api/admin/reps/${rep.id}`,null,''); ok('not signed in -> 401',r.status===401,r.status);

  r=await call('PATCH',`/api/admin/reps/${rep.id}`,{territory:'ZZ Alberta North'});
  const saved=(await a.from('reps').select('*').eq('id',rep.id).single()).data;
  ok('territory saves (needs dev-patch-rep-territory.sql)',r.status===200&&saved?.territory==='ZZ Alberta North',r.status);
  // History log (needs dev-patch-rep-activity.sql): details edit, status change, customer removed and assigned.
  const hasLog=!(await a.from('rep_activity').select('id').limit(1)).error;
  if(!hasLog) console.log('SKIP history log checks (run dev-patch-rep-activity.sql on dev first)');
  else{
    await call('PATCH',`/api/admin/reps/${rep.id}`,{phone:'ZZ 555'});
    await call('PATCH',`/api/admin/reps/${rep.id}`,{active:false});
    await call('PATCH',`/api/admin/reps/${rep.id}`,{active:true});
    const c2=(await a.from('customers').insert({company_name:'ZZ Team Co 2',contact_email:`zz-c2-${t}@yopmail.com`,customer_code:'',rep_id:null}).select().single()).data;
    // The assign/remove lines come from the customer edit route; here we use that route through the API.
    const pr=await call('PATCH',`/api/admin/customers/${c2.id}`,{rep_id:rep.id});
    const pr2=await call('PATCH',`/api/admin/customers/${c2.id}`,{rep_id:null});
    r=await call('GET',`/api/admin/reps/${rep.id}`); d=await r.json(); const L=(d.activity||[]).map(x=>x.label);
    ok('history: details changed (phone)',L.some(l=>l==='Details changed: phone'),L.join(' | '));
    ok('history: set to inactive and active',L.some(l=>l.startsWith('Set to inactive'))&&L.some(l=>l==='Set to active'),L.join(' | '));
    ok('history: customer assigned',L.some(l=>l.startsWith('Customer assigned: ZZ Team Co 2')),pr.status+' '+L.join(' | '));
    ok('history: customer removed',L.some(l=>l.startsWith('Customer removed: ZZ Team Co 2')),pr2.status+' '+L.join(' | '));
    await a.from('customers').delete().eq('id',c2.id);
  }
  r=await call('PATCH',`/api/admin/reps/${rep.id}`,{territory:''});
  ok('empty territory clears it',r.status===200&&(await a.from('reps').select('*').eq('id',rep.id).single()).data?.territory===null,r.status);
}catch(e){console.log('ERROR',e)}finally{
  await a.from('customers').delete().eq('id',c.id); // cascades to the orders, their events and requests
  await a.from('reps').delete().eq('id',rep.id);
  const {data:l}=await a.auth.admin.listUsers({perPage:1000}); for(const u of l.users) if((u.email||'').startsWith('zz-')) await a.auth.admin.deleteUser(u.id);
  const {data:lc}=await a.from('customers').select('id').like('company_name','ZZ %'); const {data:lr}=await a.from('reps').select('id').like('name','ZZ %'); const {data:l2}=await a.auth.admin.listUsers({perPage:1000});
  console.log('cleaned; leftovers — customers:',lc.length,'reps:',lr.length,'users:',l2.users.filter(u=>(u.email||'').startsWith('zz-')).length);
}
