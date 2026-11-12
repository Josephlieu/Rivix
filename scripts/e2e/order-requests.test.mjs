// Checks reorders and quote requests: a customer sends a request (never an order) to their rep, or to the admins when
// they have no rep; the rep or admin turns it into an order (exactly once, even when two people try at the same
// moment) or declines it; row security keeps each customer and rep to their own; at most 10 open requests.
// Run on DEV only, after audit-docs/deliverables/task-05-order-requests.sql, with the server started as
//   EMAIL_DRY_RUN=1 npm run dev        (dry run: requests email the rep or every admin)
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/order-requests.test.mjs
// Creates throwaway 'zz-' accounts and removes them at the end.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
import { stepUp } from './mfa.mjs'; // task 8: admin sessions need the two-step sign-in
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x);

// --- the email text (pure)
const { orderRequestEmail } = await import('../../src/lib/order-request-emails.ts');
let m=orderRequestEmail({to:'rep@example.com',handler:'rep',company:'Sayem Co',kind:'reorder',sourceBatch:'ORD-0042',items:[{product_name:'Hi-vis jacket',sizes:[{size:'M',qty:10},{size:'L',qty:5}],branding:'Logo on back'}],note:'Need by May'});
ok('the request email goes to the handler and names the customer and past order',m.to==='rep@example.com'&&/Reorder request from Sayem Co/.test(m.subject)&&/ORD-0042/.test(m.text));
ok('it lists products, sizes, totals, branding and the note',/Hi-vis jacket: M x10, L x5 \(15 total\)/.test(m.text)&&/Logo on back/.test(m.text)&&/Need by May/.test(m.text));
m=orderRequestEmail({to:null,handler:'admin',company:'<b>X</b>',kind:'quote',items:[{product_name:'Vest',sizes:[{size:'One size',qty:3}]}]});
ok('a quote request email, with typed text escaped',/Quote request from/.test(m.subject)&&!/<b>X<\/b>/.test(m.html)&&!/undefined|null/.test(m.text));

// --- the routes (dev server + dev database)
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const a=createClient(U,(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY),{auth:{persistSession:false}});
const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,x)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(x?{app_metadata:x}:{})})).data.user;
const adm=await mk(`zz-or-a-${t}@yopmail.com`,{role:'admin'}), r1=await mk(`zz-or-r1-${t}@yopmail.com`,{role:'rep'}), r2=await mk(`zz-or-r2-${t}@yopmail.com`,{role:'rep'});
const cu1=await mk(`zz-or-c1-${t}@yopmail.com`), cu2=await mk(`zz-or-c2-${t}@yopmail.com`), cu3=await mk(`zz-or-c3-${t}@yopmail.com`);
const {data:rep1}=await a.from('reps').insert({name:'ZZ OR R1',email:r1.email,user_id:r1.id}).select().single();
const {data:rep2}=await a.from('reps').insert({name:'ZZ OR R2',email:r2.email,user_id:r2.id}).select().single();
const {data:c1}=await a.from('customers').insert({user_id:cu1.id,company_name:'ZZ Req One',contact_email:cu1.email,customer_code:'',rep_id:rep1.id}).select().single();
const {data:c2}=await a.from('customers').insert({user_id:cu2.id,company_name:'ZZ Req Two',contact_email:cu2.email,customer_code:'',rep_id:rep2.id}).select().single();
const {data:c3}=await a.from('customers').insert({user_id:cu3.id,company_name:'ZZ Req No Rep',contact_email:cu3.email,customer_code:''}).select().single();
const {data:o1}=await a.from('orders').insert({customer_id:c1.id,rep_id:rep1.id,batch_number:'',product_name:'Hi-vis jacket',quantity:15,status:'Delivered'}).select().single();
await a.from('order_items').insert({order_id:o1.id,product_name:'Hi-vis jacket',quantity:15,size_breakdown:[{size:'M',qty:10},{size:'L',qty:5}],sizing:'M x10, L x5',position:0});
const {data:o2}=await a.from('orders').insert({customer_id:c2.id,rep_id:rep2.id,batch_number:'',product_name:'Other',quantity:1}).select().single();
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const x=await sb.auth.signInWithPassword({email:e,password:pw});if(x.error)throw x.error;await stepUp(sb);return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(mt,url,ck,body)=>fetch('http://localhost:10001'+url,{method:mt,headers:{'Content-Type':'application/json',...(ck?{Cookie:ck}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
const signIn=async e=>{const s=createClient(U,A,{auth:{persistSession:false}});await s.auth.signInWithPassword({email:e,password:pw});return s;};
const notifs=async(uid,kind)=>(await a.from('notifications').select('*').eq('recipient_user_id',uid).eq('kind',kind)).data||[];
const reqRow=async id=>(await a.from('order_requests').select('*').eq('id',id).single()).data;
const ordersOf=async cid=>(await a.from('orders').select('id').eq('customer_id',cid)).data||[];
const items=[{product_name:'Hi-vis jacket',sizes:[{size:'M',qty:12},{size:'L',qty:5}],branding:'Logo on back'}];
const orderBody=(cid,rid)=>({customer_id:cid,request_id:rid,items:[{product_name:'Hi-vis jacket',sizes:[{size:'M',qty:12},{size:'L',qty:5}],branding:'Logo on back'}]});
try{
  const ac=await cookie(adm.email), rc1=await cookie(r1.email), rc2=await cookie(r2.email), cc1=await cookie(cu1.email), cc2=await cookie(cu2.email), cc3=await cookie(cu3.email);

  // sending
  let r=await call('POST','/api/portal/order-requests',cc1,{kind:'reorder',source_order_id:o1.id,items,note:'Same as last time, 2 more M'}); let j=await r.json();
  ok('a customer reorders one of their own orders',r.status===201&&j.handledBy==='rep',j.error||'');
  if(j.handlerEmail==='sent'){ console.log('FAIL the dev server is NOT in dry run (EMAIL_DRY_RUN=1): stopping before more real emails'); throw new Error('not dry run'); }
  ok('  the rep is emailed (dry run)',j.handlerEmail==='dry_run',String(j.handlerEmail));
  const req1=j.request.id;
  let row=await reqRow(req1); ok('  saved as an open reorder with the products, sizes and note',row.status==='open'&&row.kind==='reorder'&&row.source_order_id===o1.id&&row.items[0].sizes[0].qty===12&&row.note==='Same as last time, 2 more M');
  ok('  it is NOT an order',(await ordersOf(c1.id)).length===1);
  ok("  the customer's rep is told in the app",(await notifs(r1.id,'order_request')).some(n=>n.link==='/rep/requests'&&/ZZ Req One/.test(n.title)));
  ok('  another rep is not told',(await notifs(r2.id,'order_request')).length===0);
  ok('  the admins are not told (the rep handles it)',!(await notifs(adm.id,'order_request')).some(n=>/ZZ Req One/.test(n.title)));
  r=await call('POST','/api/portal/order-requests',cc1,{kind:'reorder',source_order_id:o2.id,items}); ok("reordering someone else's order is refused",r.status===404);
  r=await call('POST','/api/portal/order-requests',cc1,{kind:'reorder',items}); ok('a reorder without a past order is refused',r.status===404);
  r=await call('POST','/api/portal/order-requests',cc1,{kind:'quote',items:[{product_name:'Vest',sizes:[{size:'M',qty:0}]}]}); ok('a zero quantity is refused',r.status===400);
  r=await call('POST','/api/portal/order-requests',cc1,{kind:'quote',items:[]}); ok('a request with no products is refused',r.status===400);
  r=await call('POST','/api/portal/order-requests',cc1,{kind:'order',items}); ok('an unknown kind is refused',r.status===400);
  for(const [n,ck] of [['rep',rc1],['admin',ac],['signed-out',null]]){ r=await call('POST','/api/portal/order-requests',ck,{kind:'quote',items}); ok(`${n} cannot send a customer request`,r.status===401||r.status===403); }
  r=await call('POST','/api/portal/order-requests',cc3,{kind:'quote',items:[{product_name:'Parka',sizes:[{size:'XL',qty:20}],branding:''}]}); j=await r.json();
  ok('a customer with no rep: the request goes to the admins',r.status===201&&j.handledBy==='admin'&&(await notifs(adm.id,'order_request')).some(n=>n.link==='/admin/requests'&&/ZZ Req No Rep/.test(n.title)));
  const req3=j.request.id;
  r=await call('POST','/api/portal/order-requests',cc2,{kind:'quote',items}); j=await r.json(); const req2=j.request.id;

  // who can see what (row security)
  const s1=await signIn(cu1.email), s2=await signIn(cu2.email), sr1=await signIn(r1.email), sr2=await signIn(r2.email);
  let seen=(await s1.from('order_requests').select('id')).data||[]; ok('a customer sees only their own requests',seen.length===1&&seen[0].id===req1);
  seen=(await s2.from('order_requests').select('id').eq('id',req1)).data||[]; ok("another customer cannot see them",seen.length===0);
  seen=((await sr1.from('order_requests').select('id')).data||[]).map(x=>x.id); ok("a rep sees only their own customers' requests (database)",seen.includes(req1)&&!seen.includes(req2)&&!seen.includes(req3));
  seen=((await sr2.from('order_requests').select('id')).data||[]).map(x=>x.id); ok('  and the other rep only theirs',seen.includes(req2)&&!seen.includes(req1));
  ok('a customer cannot write requests from the browser',!!(await s1.from('order_requests').insert({customer_id:c1.id,kind:'quote',items})).error);
  await s1.from('order_requests').update({status:'converted'}).eq('id',req1); ok('  or change one',(await reqRow(req1)).status==='open');
  r=await call('GET','/api/portal/order-requests',cc1); j=await r.json(); ok('the customer lists their requests',j.requests?.length===1&&j.requests[0].source?.batch_number===o1.batch_number);
  let pg=await fetch('http://localhost:10001/rep/requests',{headers:{Cookie:rc1}}); let html=await pg.text(); ok("the rep's Requests page shows their customer's request only",pg.status===200&&html.includes('ZZ Req One')&&!html.includes('ZZ Req Two'));
  pg=await fetch('http://localhost:10001/admin/requests',{headers:{Cookie:ac}}); html=await pg.text(); ok('the admin Requests page shows all, with who handles each',pg.status===200&&html.includes('ZZ Req One')&&html.includes('ZZ Req No Rep')&&html.includes('Admin (handled directly)'));
  pg=await fetch(`http://localhost:10001/rep/orders/new?request=${req1}`,{headers:{Cookie:rc1}}); html=await pg.text(); ok('the rep New Order form opens pre-filled from the request',pg.status===200&&html.includes('Pre-filled from the customer')&&html.includes('Logo on back'));
  pg=await fetch(`http://localhost:10001/rep/orders/new?request=${req2}`,{headers:{Cookie:rc1}}); html=await pg.text(); ok("another rep's customer request does not pre-fill",pg.status===200&&!html.includes('Pre-filled from the customer'));
  pg=await fetch('http://localhost:10001/portal/requests',{headers:{Cookie:cc1}}); ok('the customer Requests page loads',pg.status===200);

  // converting and declining
  r=await call('POST','/api/rep/orders',rc2,orderBody(c1.id,req1)); ok("another rep cannot convert it (not their customer)",r.status===403);
  r=await call('POST','/api/rep/orders',rc1,orderBody(c1.id,req2)); ok("a request from a different customer cannot be used",r.status===400);
  r=await call('PATCH',`/api/order-requests/${req1}`,rc2,{action:'decline',reason:'x'}); ok('another rep cannot decline it',r.status===404&&(await reqRow(req1)).status==='open');
  r=await call('PATCH',`/api/order-requests/${req1}`,cc1,{action:'decline',reason:'x'}); ok('a customer cannot decline it',r.status===403);
  r=await call('PATCH',`/api/order-requests/${req1}`,rc1,{action:'decline',reason:''}); ok('declining needs a reason',r.status===400);
  const before=(await ordersOf(c1.id)).length;
  r=await call('POST','/api/rep/orders',rc1,orderBody(c1.id,req1)); j=await r.json();
  ok('the rep turns the request into an order',r.status===201&&j.order?.id,j.error||'');
  row=await reqRow(req1); ok('  the request is converted and linked to the order',row.status==='converted'&&row.order_id===j.order.id&&row.decided_by==='ZZ OR R1');
  r=await call('POST','/api/rep/orders',rc1,orderBody(c1.id,req1)); ok('  it cannot be converted twice',r.status===409);
  ok('  exactly one order was added',(await ordersOf(c1.id)).length===before+1);
  r=await call('PATCH',`/api/order-requests/${req1}`,rc1,{action:'decline',reason:'late'}); ok('  a converted request cannot be declined',r.status===409);
  ok('  the customer was told the order exists',(await notifs(cu1.id,'order_created')).length>=1);
  r=await call('POST','/api/admin/orders',ac,orderBody(c3.id,req3)); j=await r.json(); ok("the admin converts a no-rep customer's request",r.status===201&&(await reqRow(req3)).status==='converted'&&(await reqRow(req3)).order_id===j.order.id,j.error||'');
  r=await call('PATCH',`/api/order-requests/${req2}`,rc2,{action:'decline',reason:'That style is discontinued'}); ok("the rep declines their customer's request",r.status===200&&(await reqRow(req2)).status==='declined');
  ok('  the customer sees why',(await notifs(cu2.id,'order_request_declined')).some(n=>n.body==='That style is discontinued'));
  r=await call('POST','/api/rep/orders',rc2,orderBody(c2.id,req2)); ok('  a declined request cannot be converted',r.status===409);

  // two converts at the same moment: exactly one order survives
  const race=async(name,mkA,mkB)=>{
    r=await call('POST','/api/portal/order-requests',cc1,{kind:'quote',items}); const rid=(await r.json()).request.id;
    const n0=(await ordersOf(c1.id)).length;
    const [x,y]=await Promise.all([mkA(rid),mkB(rid)]);
    const codes=[x.status,y.status].sort();
    const n1=(await ordersOf(c1.id)).length;
    const won=[x,y].find(z=>z.status===201); const wonId=won?(await won.json()).order.id:null;
    const rr=await reqRow(rid);
    ok(`race (${name}): one succeeds, the other gets 409`,codes[0]===201&&codes[1]===409,JSON.stringify(codes));
    ok(`race (${name}): exactly one order exists and the request points at it`,n1===n0+1&&rr.status==='converted'&&rr.order_id===wonId);
  };
  await race('the rep twice',rid=>call('POST','/api/rep/orders',rc1,orderBody(c1.id,rid)),rid=>call('POST','/api/rep/orders',rc1,orderBody(c1.id,rid)));
  await race('the rep and an admin',rid=>call('POST','/api/rep/orders',rc1,orderBody(c1.id,rid)),rid=>call('POST','/api/admin/orders',ac,orderBody(c1.id,rid)));

  // at most 10 open requests
  const openCount=async()=>(await a.from('order_requests').select('id',{count:'exact',head:true}).eq('customer_id',c1.id).eq('status','open')).count||0;
  for(let guard=0; guard<12 && await openCount()<9; guard++){ await call('POST','/api/portal/order-requests',cc1,{kind:'quote',items}); }
  ok('nine open requests are allowed',await openCount()===9);
  const burst=await Promise.all([1,2,3].map(()=>call('POST','/api/portal/order-requests',cc1,{kind:'quote',items})));
  ok('three requests at once when 9 are open: only one gets in (database limit)',burst.filter(x=>x.status===201).length===1&&await openCount()===10,JSON.stringify(burst.map(x=>x.status)));
  r=await call('POST','/api/portal/order-requests',cc1,{kind:'reorder',source_order_id:o1.id,items}); j=await r.json();
  ok('the 11th open request is refused with a clear message',r.status===409&&/10 open requests/.test(j.error)&&await openCount()===10,j.error);

  // the request follows the customer when the rep changes
  const {data:anyOpen}=await a.from('order_requests').select('id').eq('customer_id',c1.id).eq('status','open').limit(1).single();
  r=await call('PATCH',`/api/admin/customers/${c1.id}`,ac,{rep_id:rep2.id}); ok('admin moves the customer to the other rep',r.status===200);
  seen=((await sr2.from('order_requests').select('id').eq('id',anyOpen.id)).data||[]); ok('  the new rep now sees the open request',seen.length===1);
  seen=((await sr1.from('order_requests').select('id').eq('id',anyOpen.id)).data||[]); ok('  the old rep no longer does',seen.length===0);
  r=await call('POST','/api/rep/orders',rc1,orderBody(c1.id,anyOpen.id)); ok('  the old rep can no longer convert it',r.status===403);
}catch(e){console.log('ERROR',e)}finally{
  await a.from('order_requests').delete().in('customer_id',[c1.id,c2.id,c3.id]);
  await a.from('orders').delete().in('customer_id',[c1.id,c2.id,c3.id]);
  await a.from('customers').delete().in('id',[c1.id,c2.id,c3.id]); await a.from('reps').delete().in('id',[rep1.id,rep2.id]);
  for(const u of [adm,r1,r2,cu1,cu2,cu3]) await a.auth.admin.deleteUser(u.id); console.log('cleaned');
}
