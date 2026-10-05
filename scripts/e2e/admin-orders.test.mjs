// End-to-end test (dev database + running dev server). Run from the project root: node scripts/e2e/admin-orders.test.mjs
// Creates throwaway 'zz-' accounts and removes them at the end. Needs `npm run dev` running and .env.local.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module'; const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x); const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,m)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(m?{app_metadata:m}:{})})).data.user;
const adm=await mk(`zz-adm-${t}@yopmail.com`,{role:'admin'}), ru=await mk(`zz-r-${t}@yopmail.com`,{role:'rep'}), cu=await mk(`zz-c-${t}@yopmail.com`), cu2=await mk(`zz-c2-${t}@yopmail.com`);
const {data:rep}=await a.from('reps').insert({name:'ZZ R',email:ru.email,user_id:ru.id}).select().single();
const {data:c}=await a.from('customers').insert({user_id:cu.id,company_name:'ZZ Cust',contact_email:cu.email,customer_code:'',rep_id:rep.id}).select().single();
const {data:c2}=await a.from('customers').insert({user_id:cu2.id,company_name:'ZZ Cust2',contact_email:cu2.email,customer_code:''}).select().single();
const {data:o}=await a.from('orders').insert({customer_id:c.id,rep_id:rep.id,batch_number:'',product_name:'Coat',quantity:5}).select().single();
await a.from('order_items').insert({order_id:o.id,product_name:'Coat',quantity:5,size_breakdown:[{size:'M',qty:5}],sizing:'M x5'});
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const r=await sb.auth.signInWithPassword({email:e,password:pw});if(r.error)throw r.error;return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(m,url,ck,body)=>fetch('http://localhost:10001'+url,{method:m,headers:{'Content-Type':'application/json',...(ck?{Cookie:ck}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
try{
  const ac=await cookie(adm.email), rc=await cookie(ru.email), cc=await cookie(cu.email);
  let r=await call('GET','/api/admin/orders',ac); let j=await r.json();
  ok('admin lists orders incl. the rep-made one',r.status===200&&j.orders.some(x=>x.id===o.id&&x.customer==='ZZ Cust'&&x.rep==='ZZ R'));
  for(const [n,ck] of [['rep',rc],['customer',cc],['signed-out',null]]){
    r=await call('GET','/api/admin/orders',ck); ok(`${n} refused on list`,r.status===401||r.status>=300);
    r=await call('PATCH',`/api/admin/orders/${o.id}`,ck,{status:'Shipped'}); ok(`${n} cannot change stage`,r.status===401||r.status>=300);
    r=await call('POST',`/api/admin/orders/${o.id}/notes`,ck,{note:'x'}); ok(`${n} cannot add note`,r.status===401||r.status>=300);
  }
  r=await call('GET',`/api/admin/orders/${o.id}`,ac); j=await r.json();
  ok('detail returns order, customer, rep, items, events',r.status===200&&j.items.length===1&&j.customer.company_name==='ZZ Cust'&&j.customer.rep?.name==='ZZ R'&&j.events.length===1,JSON.stringify(j.events.map(e=>e.status)));
  r=await call('PATCH',`/api/admin/orders/${o.id}`,ac,{status:'Bogus'}); ok('invalid stage rejected',r.status===400);
  r=await call('PATCH',`/api/admin/orders/${o.id}`,ac,{status:'In Production',note:'Fabric cut'}); ok('admin changes stage',r.status===200);
  let {data:ev}=await a.from('order_events').select('*').eq('order_id',o.id).order('created_at');
  const e2=ev.find(e=>e.status==='In Production'); ok('timeline records change with who + note',e2&&e2.created_by===adm.email&&e2.note==='Fabric cut',JSON.stringify(e2&&[e2.created_by,e2.note]));
  r=await call('PATCH',`/api/admin/orders/${o.id}`,ac,{status:'In Production'}); j=await r.json(); ok('same stage = no change, no duplicate event',j.changed===false);
  r=await call('PATCH',`/api/admin/orders/${o.id}`,ac,{carrier:'Purolator',tracking_number:'PU123'}); ok('shipping saved',r.status===200);
  let {data:ord}=await a.from('orders').select('carrier,tracking_number,status').eq('id',o.id).single(); ok('carrier + tracking stored',ord.carrier==='Purolator'&&ord.tracking_number==='PU123'&&ord.status==='In Production');
  r=await call('POST',`/api/admin/orders/${o.id}/notes`,ac,{note:'INTERNAL margin note',customer_visible:false}); ok('internal note added',r.status===201);
  r=await call('POST',`/api/admin/orders/${o.id}/notes`,ac,{note:'Sample approved',customer_visible:true}); ok('visible note added',r.status===201);
  r=await call('POST',`/api/admin/orders/${o.id}/notes`,ac,{note:'  '}); ok('blank note rejected',r.status===400);
  const sbc=createClient(U,A,{auth:{persistSession:false}}); await sbc.auth.signInWithPassword({email:cu.email,password:pw});
  const {data:seen}=await sbc.from('order_events').select('note,status').eq('order_id',o.id);
  ok('customer sees visible notes + stages',seen.some(e=>e.note==='Sample approved')&&seen.some(e=>e.status==='In Production'));
  ok('customer NEVER sees the internal note',!seen.some(e=>(e.note||'').includes('INTERNAL')),seen.length+' events visible');
  const sbc2=createClient(U,A,{auth:{persistSession:false}}); await sbc2.auth.signInWithPassword({email:cu2.email,password:pw});
  const {data:other}=await sbc2.from('order_events').select('id').eq('order_id',o.id); ok("another customer sees none of it",other.length===0);
  r=await call('PATCH',`/api/admin/orders/${o.id}`,ac,{status:'Cancelled'}); r=await call('PATCH',`/api/admin/orders/${o.id}`,ac,{status:'Shipped'}); ok('cancelled order can be reopened',r.status===200);
  const pg=await fetch('http://localhost:10001/admin/orders',{headers:{Cookie:ac}}); ok('admin orders page 200',pg.status===200);
  const pd=await fetch(`http://localhost:10001/admin/orders/${o.id}`,{headers:{Cookie:ac}}); ok('admin order page 200',pd.status===200);
  const rd=await fetch(`http://localhost:10001/rep/orders/${o.id}`,{headers:{Cookie:rc}}); const rh=await rd.text(); ok('rep sees updated stage + tracking',rd.status===200&&rh.includes('Shipped')&&rh.includes('PU123'));
}catch(e){console.log('ERROR',e)}finally{
  await a.from('orders').delete().in('customer_id',[c.id,c2.id]);await a.from('customers').delete().in('id',[c.id,c2.id]);await a.from('reps').delete().eq('id',rep.id);
  for(const u of [adm,ru,cu,cu2]) await a.auth.admin.deleteUser(u.id);console.log('cleaned');
}
