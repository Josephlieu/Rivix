// End-to-end test (dev database + running dev server). Run from the project root: node scripts/e2e/rep-orders.test.mjs
// Rep creates orders: size grid validation, ownership rules, row security, rollback. Creates throwaway 'zz-' accounts and removes them.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x); const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,m)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(m?{app_metadata:m}:{})})).data.user;
const repU=await mk(`zz-rep-${t}@yopmail.com`,{role:'rep'}), rep2U=await mk(`zz-rep2-${t}@yopmail.com`,{role:'rep'}), custU=await mk(`zz-cust-${t}@yopmail.com`), cust2U=await mk(`zz-cust2-${t}@yopmail.com`);
const {data:rep}=await a.from('reps').insert({name:'ZZ Rep',email:repU.email,user_id:repU.id}).select().single();
const {data:rep2}=await a.from('reps').insert({name:'ZZ Rep2',email:rep2U.email,user_id:rep2U.id}).select().single();
const {data:c1}=await a.from('customers').insert({user_id:custU.id,company_name:'ZZ Mine',contact_email:custU.email,customer_code:'',rep_id:rep.id}).select().single();
const {data:c2}=await a.from('customers').insert({user_id:cust2U.id,company_name:'ZZ Other',contact_email:cust2U.email,customer_code:'',rep_id:rep2.id}).select().single();
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const r=await sb.auth.signInWithPassword({email:e,password:pw});if(r.error)throw r.error;return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const post=(ck,body)=>fetch('http://localhost:10001/api/rep/orders',{method:'POST',headers:{'Content-Type':'application/json',...(ck?{Cookie:ck}:{})},body:JSON.stringify(body)});
const good={customer_id:c1.id,items:[{product_name:'Hi-vis jacket',sizes:[{size:'M',qty:10},{size:'L',qty:20}],branding:'logo'},{product_name:'Vest',sizes:[{size:'One size',qty:20}]}],delivery_location:'Calgary',po_number:'PO-1',pricing:'$45',special_requirements:'rush'};
try{
  const rc=await cookie(repU.email), rc2=await cookie(rep2U.email), cc=await cookie(custU.email);
  let r=await post(rc,good); let j=await r.json(); const id=j.order?.id;
  ok('rep creates an order for their own customer',r.status===201&&/^ORD-\d+$/.test(j.order?.batch_number),JSON.stringify(j));
  const {data:o}=await a.from('orders').select('*').eq('id',id).single(); const {data:it}=await a.from('order_items').select('*').eq('order_id',id);
  ok('saved right: total 50, summary text, rep, stage, PO',o.quantity===50&&o.product_name==='Hi-vis jacket + 1 more'&&o.rep_id===rep.id&&o.status==='Order Received'&&o.po_number==='PO-1');
  const jk=it.find(x=>x.product_name==='Hi-vis jacket');
  ok('sizes stored as data, quantity = sum, readable text built',JSON.stringify(jk.size_breakdown.map(s=>[s.size,s.qty]))==='[["M",10],["L",20]]'&&jk.quantity===30&&jk.sizing==='M x10, L x20');
  const {data:ev}=await a.from('order_events').select('status').eq('order_id',id); ok('timeline starts at Order Received',ev.length===1&&ev[0].status==='Order Received');
  r=await post(rc,{...good,customer_id:c2.id}); ok("cannot create for another rep's customer",r.status===403);
  r=await post(rc,{...good,items:[]}); ok('no products rejected',r.status===400);
  r=await post(rc,{...good,items:[{product_name:'x',sizes:[]}]}); ok('no sizes rejected',r.status===400);
  r=await post(rc,{...good,items:[{product_name:'x',sizes:[{size:'M',qty:0}]}]}); ok('quantity 0 rejected',r.status===400);
  r=await post(rc,{...good,items:[{product_name:'x',sizes:[{size:'M',qty:1.5}]}]}); ok('fractional quantity rejected',r.status===400);
  r=await post(rc,{...good,items:[{product_name:'x',sizes:[{size:'M',qty:1},{size:'m',qty:2}]}]}); ok('duplicate size rejected',r.status===400);
  r=await post(rc,{...good,items:[{product_name:'x',sizes:[{size:'',qty:3}]}]}); ok('blank size name rejected',r.status===400);
  r=await post(rc,{...good,items:[{product_name:'',sizes:[{size:'M',qty:2}]}]}); ok('empty product name rejected',r.status===400);
  r=await post(rc,{...good,items:[{product_name:'x',quantity:50}]}); ok('old quantity-only request rejected',r.status===400);
  r=await post(cc,good); ok('customer refused',r.status===403);
  r=await post(null,good); ok('signed-out refused',r.status===403||r.status===401);
  const {count}=await a.from('orders').select('id',{count:'exact',head:true}).eq('customer_id',c1.id); ok('only the one good order exists after all bad attempts',count===1,count);
  const s1=createClient(U,A,{auth:{persistSession:false}}); await s1.auth.signInWithPassword({email:custU.email,password:pw});
  const seen=await s1.from('orders').select('id'); ok('customer sees their own order',seen.data.length===1&&seen.data[0].id===id);
  await s1.from('orders').update({status:'Delivered'}).eq('id',id); ok('customer cannot change the stage',(await a.from('orders').select('status').eq('id',id).single()).data.status==='Order Received');
  const rp=await fetch(`http://localhost:10001/rep/orders/${id}`,{headers:{Cookie:rc}}); const h=await rp.text(); ok('rep order page shows size tags',rp.status===200&&h.includes('One size'));
  const d2=await fetch(`http://localhost:10001/rep/orders/${id}`,{headers:{Cookie:rc2}}); ok("another rep gets 404 on the order",d2.status===404);
  const cp=await fetch(`http://localhost:10001/rep/customers/${c1.id}`,{headers:{Cookie:rc}}); ok('owning rep sees their customer page',cp.status===200&&(await cp.text()).includes('ZZ Mine'));
  const cp2=await fetch(`http://localhost:10001/rep/customers/${c1.id}`,{headers:{Cookie:rc2}}); ok("another rep gets 404 on someone else's customer",cp2.status===404);
}catch(e){console.log('ERROR',e)}finally{
  await a.from('orders').delete().in('customer_id',[c1.id,c2.id]);await a.from('customers').delete().in('id',[c1.id,c2.id]);await a.from('reps').delete().in('id',[rep.id,rep2.id]);
  for(const u of [repU,rep2U,custU,cust2U]) await a.auth.admin.deleteUser(u.id);
  const {data:lc}=await a.from('customers').select('id').like('company_name','ZZ %'); console.log('cleaned; leftover ZZ customers:',lc.length);
}
