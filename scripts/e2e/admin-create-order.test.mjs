// End-to-end test (dev database + running dev server). Run from the project root: node scripts/e2e/admin-create-order.test.mjs
// An admin creates an order for any customer. Creates throwaway 'zz-' accounts and removes them at the end.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x); const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,m)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(m?{app_metadata:m}:{})})).data.user;
const adm=await mk(`zz-oa-${t}@yopmail.com`,{role:'admin'}), repU=await mk(`zz-or-${t}@yopmail.com`,{role:'rep'});
const cu1=await mk(`zz-oc1-${t}@yopmail.com`), cu2=await mk(`zz-oc2-${t}@yopmail.com`), cu3=await mk(`zz-oc3-${t}@yopmail.com`);
const {data:rep}=await a.from('reps').insert({name:'ZZ Rep',email:repU.email,user_id:repU.id}).select().single();
const rep2U=await mk(`zz-or2-${t}@yopmail.com`,{role:'rep'}); const {data:rep2}=await a.from('reps').insert({name:'ZZ Rep Two',email:rep2U.email,user_id:rep2U.id}).select().single();
const {data:offRep}=await a.from('reps').insert({name:'ZZ Off Rep',email:`zz-off-${t}@yopmail.com`,active:false}).select().single();
const {data:c1}=await a.from('customers').insert({user_id:cu1.id,company_name:'ZZ With Rep',contact_email:cu1.email,customer_code:'',rep_id:rep.id}).select().single();
const {data:c2}=await a.from('customers').insert({user_id:cu2.id,company_name:'ZZ No Rep',contact_email:cu2.email,customer_code:''}).select().single();
const {data:c3}=await a.from('customers').insert({user_id:cu3.id,company_name:'ZZ Disabled',contact_email:cu3.email,customer_code:'',rep_id:rep.id}).select().single();
await a.auth.admin.updateUserById(cu3.id,{ban_duration:'876000h'});
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const r=await sb.auth.signInWithPassword({email:e,password:pw});if(r.error)throw r.error;return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(m,url,ck,body)=>fetch('http://localhost:10001'+url,{method:m,headers:{'Content-Type':'application/json',...(ck?{Cookie:ck}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
const item=(name='ZZ Jacket',sizes=[{size:'M',qty:10},{size:'L',qty:5}])=>({product_name:name,sizes,branding:'Logo on back'});
const made=[];
try{
  const ac=await cookie(adm.email), rc=await cookie(repU.email), cc=await cookie(cu1.email);

  // --- only an admin can use the admin route
  for(const [n,ck] of [['signed-out',null],['customer',cc],['rep',rc]]){
    const x=await call('POST','/api/admin/orders',ck,{customer_id:c1.id,items:[item()]}); ok(`${n} cannot create an order through the admin route`,x.status===401||x.status===403||x.status>=300);
  }

  // --- admin creates for a customer who HAS a rep
  let r=await call('POST','/api/admin/orders',ac,{customer_id:c1.id,items:[item(),item('ZZ Pants',[{size:'32',qty:20}])],delivery_location:'1 Test St',po_number:'PO-ZZ-1',pricing:'$10',special_requirements:'ZZ note'}); let j=await r.json();
  ok('admin creates an order',r.status===201&&j.order?.batch_number?.startsWith('ORD-'),j.error||''); if(j.order) made.push(j.order.id);
  const {data:o1}=await a.from('orders').select('*').eq('id',j.order?.id).single();
  ok('order belongs to the customer and keeps the customer\'s rep',o1?.customer_id===c1.id&&o1?.rep_id===rep.id);
  ok('total quantity is the sum of every size (35)',o1?.quantity===35&&/ZZ Jacket \+ 1 more/.test(o1?.product_name||''));
  ok('extra details saved',o1?.delivery_location==='1 Test St'&&o1?.po_number==='PO-ZZ-1'&&o1?.special_requirements==='ZZ note');
  const {data:items}=await a.from('order_items').select('product_name,quantity').eq('order_id',j.order?.id).order('position'); ok('both products saved',items?.length===2&&items[0].quantity===15&&items[1].quantity===20);
  const {data:ev}=await a.from('order_events').select('status,note,customer_visible,created_by').eq('order_id',j.order?.id);
  ok('the timeline starts at Order Received',ev?.some(e=>e.status==='Order Received'));
  ok('an INTERNAL note records that an admin entered it, and who',ev?.some(e=>e.customer_visible===false&&/entered by admin/.test(e.note||'')&&e.created_by===adm.email));
  const nCust=await a.from('notifications').select('title,link').eq('recipient_user_id',cu1.id).eq('order_id',j.order?.id); ok('the customer is notified, with a working link',nCust.data?.length===1&&nCust.data[0].link===`/portal/orders/${j.order.batch_number}`);
  const nRep=await a.from('notifications').select('title,link').eq('recipient_user_id',repU.id).eq('order_id',j.order?.id); ok('the customer\'s rep is notified',nRep.data?.length===1&&nRep.data[0].link===`/rep/orders/${j.order.id}`);

  // --- a customer with NO rep still works; nobody to notify
  r=await call('POST','/api/admin/orders',ac,{customer_id:c2.id,items:[item()]}); j=await r.json(); ok('admin creates an order for a customer with no rep',r.status===201,j.error||''); if(j.order) made.push(j.order.id);
  const {data:o2}=await a.from('orders').select('rep_id').eq('id',j.order?.id).single(); ok('that order has no rep',o2?.rep_id===null);

  // --- bad input is refused
  for(const [n,b] of [['no customer',{items:[item()]}],['no products',{customer_id:c1.id,items:[]}],['a product with no name',{customer_id:c1.id,items:[item('')]}],['a zero quantity',{customer_id:c1.id,items:[item('X',[{size:'M',qty:0}])]}],['a decimal quantity',{customer_id:c1.id,items:[item('X',[{size:'M',qty:1.5}])]}],['a size listed twice',{customer_id:c1.id,items:[item('X',[{size:'M',qty:1},{size:'m',qty:2}])]}],['more than 50 products',{customer_id:c1.id,items:Array.from({length:51},()=>item())}]]){
    const x=await call('POST','/api/admin/orders',ac,b); ok(`refused: ${n}`,x.status===400);
  }
  r=await call('POST','/api/admin/orders',ac,{customer_id:'00000000-0000-0000-0000-000000000000',items:[item()]}); ok('an unknown customer gives 404',r.status===404);
  r=await call('POST','/api/admin/orders',ac,{customer_id:c3.id,items:[item()]}); j=await r.json(); ok('a disabled customer is refused with a clear message',r.status===409&&/disabled/i.test(j.error||''));
  const none=await a.from('orders').select('id').eq('customer_id',c3.id); ok('nothing was saved for the disabled customer',none.data.length===0);

  // --- the admin chooses a sales rep for the order
  const rc2=await cookie(rep2U.email);
  r=await call('POST','/api/admin/orders',ac,{customer_id:c1.id,rep_id:rep.id,items:[item('ZZ Same Rep')]}); j=await r.json(); ok('choosing the customer\'s current rep changes nothing',r.status===201&&(await a.from('customers').select('rep_id').eq('id',c1.id).single()).data.rep_id===rep.id,j.error||''); if(j.order) made.push(j.order.id);
  r=await call('POST','/api/admin/orders',ac,{customer_id:c1.id,rep_id:rep2.id,items:[item('ZZ Other Rep')]}); j=await r.json(); ok('admin creates an order and picks a different rep',r.status===201,j.error||''); if(j.order) made.push(j.order.id);
  const {data:cAfter}=await a.from('customers').select('rep_id').eq('id',c1.id).single(); ok('the customer is now assigned to the chosen rep',cAfter.rep_id===rep2.id);
  const {data:oPick}=await a.from('orders').select('rep_id').eq('id',j.order?.id).single(); ok('the order carries the chosen rep',oPick?.rep_id===rep2.id);
  const evPick=await a.from('order_events').select('note').eq('order_id',j.order?.id); ok('the timeline says who was assigned',evPick.data?.some(e=>/Sales rep set to ZZ Rep Two/.test(e.note||'')));
  const nNew=await a.from('notifications').select('kind').eq('recipient_user_id',rep2U.id); ok('the chosen rep is told about the order AND the new customer',nNew.data?.some(n=>n.kind==='new_order')&&nNew.data?.some(n=>n.kind==='customer_assigned'));
  const nOld=await a.from('notifications').select('kind').eq('recipient_user_id',repU.id).eq('kind','customer_unassigned'); ok('the previous rep is told the customer moved',nOld.data?.length>=1);
  const nCu=await a.from('notifications').select('kind').eq('recipient_user_id',cu1.id).eq('kind','rep_changed'); ok('the customer is told their rep changed',nCu.data?.length>=1);
  const open2=await fetch(`http://localhost:10001/rep/orders/${j.order.id}`,{headers:{Cookie:rc2}}); ok('the chosen rep can open the order',open2.status===200&&(await open2.text()).includes('ZZ Other Rep'));
  const open1=await fetch(`http://localhost:10001/rep/orders/${j.order.id}`,{headers:{Cookie:rc}}); ok('the previous rep can no longer open it',open1.status===404);
  r=await call('POST','/api/admin/orders',ac,{customer_id:c2.id,rep_id:rep.id,items:[item('ZZ Gets A Rep')]}); j=await r.json(); ok('a customer with no rep can be given one while creating the order',r.status===201&&(await a.from('customers').select('rep_id').eq('id',c2.id).single()).data.rep_id===rep.id,j.error||''); if(j.order) made.push(j.order.id);
  r=await call('POST','/api/admin/orders',ac,{customer_id:c1.id,rep_id:offRep.id,items:[item('ZZ Off')]}); ok('a disabled rep cannot be chosen',r.status===400);
  r=await call('POST','/api/admin/orders',ac,{customer_id:c1.id,rep_id:'00000000-0000-0000-0000-000000000000',items:[item('ZZ Ghost')]}); ok('an unknown rep is refused',r.status===400);
  const cStill=await a.from('customers').select('rep_id').eq('id',c1.id).single(); ok('a refused order does not change the customer\'s rep',cStill.data.rep_id===rep2.id);

  // --- the admin handles it directly ("Admin (handled directly)")
  r=await call('POST','/api/admin/orders',ac,{customer_id:c1.id,rep_id:'none',items:[item('ZZ Admin Sale')]}); j=await r.json(); ok('admin creates an order handled directly (no rep) for a customer who had a rep',r.status===201,j.error||''); if(j.order) made.push(j.order.id);
  const {data:cNone}=await a.from('customers').select('rep_id').eq('id',c1.id).single(); const {data:oNone}=await a.from('orders').select('rep_id').eq('id',j.order?.id).single();
  ok('the customer and the order now have no rep',cNone.rep_id===null&&oNone.rep_id===null);
  const evNone=await a.from('order_events').select('note').eq('order_id',j.order?.id); ok('the timeline says it is handled directly by admin',evNone.data?.some(e=>/handled directly by admin/.test(e.note||'')));
  const stillOpen=await fetch(`http://localhost:10001/rep/orders/${j.order.id}`,{headers:{Cookie:rc2}}); ok('the rep who had the customer can no longer open the order',stillOpen.status===404);
  r=await call('POST','/api/admin/orders',ac,{customer_id:c1.id,rep_id:'none',items:[item('ZZ Admin Again')]}); j=await r.json(); ok('choosing admin for a customer who already has no rep changes nothing',r.status===201&&(await a.from('customers').select('rep_id').eq('id',c1.id).single()).data.rep_id===null,j.error||''); if(j.order) made.push(j.order.id);

  // --- the rep route still works exactly as before (shared validation)
  await a.from('customers').update({rep_id:rep2.id}).eq('id',c1.id);
  r=await call('POST','/api/rep/orders',rc,{customer_id:c2.id,items:[item('ZZ Rep Order')]}); j=await r.json(); ok('a rep can still create an order for their own customer',r.status===201,j.error||''); if(j.order) made.push(j.order.id);
  r=await call('POST','/api/rep/orders',rc,{customer_id:c1.id,items:[item()]}); ok('a rep still cannot create one for a customer that is not theirs',r.status===403);

  // --- it shows in the admin list
  r=await call('GET','/api/admin/orders',ac); j=await r.json(); ok('the new orders appear in the admin Orders list',made.every(id=>j.orders.some(o=>o.id===id)));
}catch(e){console.log('ERROR',e)}finally{
  await a.from('orders').delete().in('customer_id',[c1.id,c2.id,c3.id]);
  await a.from('customers').delete().in('id',[c1.id,c2.id,c3.id]); await a.from('reps').delete().in('id',[rep.id,rep2.id,offRep.id]);
  for(const u of [adm,repU,rep2U,cu1,cu2,cu3]) await a.auth.admin.deleteUser(u.id); console.log('cleaned');
}
