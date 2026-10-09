// End-to-end test (dev database + running dev server). Run from the project root: node scripts/e2e/notifications.test.mjs
// Creates throwaway 'zz-' accounts and removes them at the end. Needs `npm run dev` running and .env.local.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module'; const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x); const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,m)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(m?{app_metadata:m}:{})})).data.user;
const adm=await mk(`zz-na-${t}@yopmail.com`,{role:'admin'}), r1=await mk(`zz-nr1-${t}@yopmail.com`,{role:'rep'}), r2=await mk(`zz-nr2-${t}@yopmail.com`,{role:'rep'}), cu1=await mk(`zz-nc1-${t}@yopmail.com`), cu2=await mk(`zz-nc2-${t}@yopmail.com`);
const {data:rep1}=await a.from('reps').insert({name:'ZZ N1',email:r1.email,user_id:r1.id}).select().single();
const {data:rep2}=await a.from('reps').insert({name:'ZZ N2',email:r2.email,user_id:r2.id}).select().single();
const {data:c1}=await a.from('customers').insert({user_id:cu1.id,company_name:'ZZ Notif Co',contact_email:cu1.email,customer_code:'',rep_id:rep1.id}).select().single();
const {data:c2}=await a.from('customers').insert({user_id:cu2.id,company_name:'ZZ Notif Two',contact_email:cu2.email,customer_code:'',rep_id:rep2.id}).select().single();
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const r=await sb.auth.signInWithPassword({email:e,password:pw});if(r.error)throw r.error;return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(m,url,ck,body)=>fetch('http://localhost:10001'+url,{method:m,headers:{'Content-Type':'application/json',...(ck?{Cookie:ck}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
const notifs=async uid=>(await a.from('notifications').select('*').eq('recipient_user_id',uid).order('created_at')).data||[];
let orderId, docPath;
try{
  const ac=await cookie(adm.email), rc1=await cookie(r1.email), rc2=await cookie(r2.email), cc1=await cookie(cu1.email), cc2=await cookie(cu2.email);
  // 1 rep creates an order -> admin notified
  let r=await call('POST','/api/rep/orders',rc1,{customer_id:c1.id,items:[{product_name:'Coat',sizes:[{size:'M',qty:5}]}]}); let j=await r.json(); orderId=j.order.id; const num=j.order.batch_number;
  ok('rep creates order',r.status===201,num);
  let n=await notifs(adm.id); const nn=n.find(x=>x.kind==='new_order'&&x.order_id===orderId);
  ok('admin notified of the new order, link opens it',!!nn&&nn.link===`/admin/orders/${orderId}`&&nn.title.includes(num),nn?.title);
  const oc=(await notifs(cu1.id)).find(x=>x.kind==='order_created'); ok('customer told the order was created, link opens it',oc&&oc.link===`/portal/orders/${num}`&&oc.title.includes(num),oc?.title); ok('the rep who created it is NOT notified of their own action',(await notifs(r1.id)).length===0);
  // 2 admin stage change -> customer + rep
  r=await call('PATCH',`/api/admin/orders/${orderId}`,ac,{status:'In Production',note:'Fabric cut'}); ok('admin changes stage',r.status===200);
  const cn=(await notifs(cu1.id)).find(x=>x.kind==='stage_changed'), rn=(await notifs(r1.id)).find(x=>x.kind==='stage_changed');
  ok('customer notified, link goes to their order page',cn&&cn.link===`/portal/orders/${num}`&&cn.title.includes('In Production')&&cn.body==='Fabric cut',cn?.link);
  ok('rep notified, link goes to the rep order page',rn&&rn.link===`/rep/orders/${orderId}`);
  ok('other customer and other rep NOT notified',(await notifs(cu2.id)).length===0&&(await notifs(r2.id)).length===0);
  r=await call('PATCH',`/api/admin/orders/${orderId}`,ac,{status:'In Production'}); ok('same stage again sends nothing new',(await notifs(cu1.id)).filter(x=>x.kind==='stage_changed').length===1);
  // 3 notes
  await call('POST',`/api/admin/orders/${orderId}/notes`,ac,{note:'INTERNAL secret',customer_visible:false});
  ok('internal note notifies nobody',!(await notifs(cu1.id)).some(x=>(x.body||'').includes('INTERNAL')));
  await call('POST',`/api/admin/orders/${orderId}/notes`,ac,{note:'Sample approved',customer_visible:true});
  ok('visible note notifies the customer',(await notifs(cu1.id)).some(x=>x.kind==='order_note'&&x.body==='Sample approved'));
  // 4 document request
  r=await call('POST',`/api/rep/orders/${orderId}/document-requests`,rc2,{doc_type:'CSA Certificate'}); ok("another rep cannot request on someone else's order",r.status===404);
  r=await call('POST',`/api/rep/orders/${orderId}/document-requests`,cc1,{doc_type:'CSA Certificate'}); ok('customer cannot send a request',r.status===403);
  r=await call('POST',`/api/rep/orders/${orderId}/document-requests`,null,{doc_type:'CSA Certificate'}); ok('signed-out cannot send a request',r.status===403||r.status>=300);
  r=await call('POST',`/api/rep/orders/${orderId}/document-requests`,rc1,{doc_type:'CSA Certificate',note:'Needed before shipping'}); ok('rep requests a document',r.status===201);
  const dn=(await notifs(adm.id)).find(x=>x.kind==='document_request'); ok('admin notified with the type, order and note',dn&&dn.body.includes('CSA Certificate')&&dn.body.includes('Needed before shipping')&&dn.link===`/admin/orders/${orderId}`,dn?.body);
  let {data:reqs}=await a.from('document_requests').select('*').eq('order_id',orderId); ok('request saved as open',reqs.length===1&&reqs[0].status==='open'&&reqs[0].rep_id===rep1.id);
  r=await call('PATCH',`/api/admin/document-requests/${reqs[0].id}`,cc1); ok('customer cannot mark a request done',r.status===401||r.status>=300);
  r=await call('PATCH',`/api/admin/document-requests/${reqs[0].id}`,rc1); ok('rep cannot mark a request done',r.status===401||r.status>=300);
  // 5 admin uploads matching doc -> request done, rep + customer notified
  const content=Buffer.from('%PDF-1.4 notif test '+t);
  r=await call('POST',`/api/admin/orders/${orderId}/documents/upload-url`,ac,{file_name:'csa.pdf',size:content.length,mime:'application/pdf'}); j=await r.json(); docPath=j.path;
  await createClient(U,A,{auth:{persistSession:false}}).storage.from('documents').uploadToSignedUrl(j.path,j.token,content,{contentType:'application/pdf'});
  r=await call('POST',`/api/admin/orders/${orderId}/documents`,ac,{path:j.path,file_name:'csa.pdf',title:'CSA jackets',doc_type:'CSA Certificate'}); ok('admin uploads the requested document',r.status===201);
  ({data:reqs}=await a.from('document_requests').select('*').eq('order_id',orderId)); ok('matching request closed automatically',reqs[0].status==='done'&&reqs[0].done_by===adm.email);
  ok('rep told the request was fulfilled',(await notifs(r1.id)).some(x=>x.kind==='request_done'&&x.link===`/rep/orders/${orderId}`));
  ok('customer told about the new document',(await notifs(cu1.id)).some(x=>x.kind==='document_added'&&x.link===`/portal/orders/${num}`));
  // a non-matching upload does not close a different request
  await call('POST',`/api/rep/orders/${orderId}/document-requests`,rc1,{doc_type:'Test Report'});
  ({data:reqs}=await a.from('document_requests').select('*').eq('order_id',orderId).eq('doc_type','Test Report'));
  r=await call('PATCH',`/api/admin/document-requests/${reqs[0].id}`,ac); ok('admin marks a request done by hand',r.status===200);
  ok('rep told that one was handled too',(await notifs(r1.id)).filter(x=>x.kind==='request_done').length===2);
  // 6 privacy: browser access
  const mkc=async e=>{const s=createClient(U,A,{auth:{persistSession:false}});await s.auth.signInWithPassword({email:e,password:pw});return s};
  const s1=await mkc(cu1.email), s2=await mkc(cu2.email);
  const my=await s1.from('notifications').select('id,recipient_user_id'); ok('customer reads only their own notifications',my.data.length>0&&my.data.every(x=>x.recipient_user_id===cu1.id),my.data.length);
  ok("other customer sees none of them",(await s2.from('notifications').select('id')).data.length===0);
  const adminRows=(await notifs(adm.id)); const peek=await s1.from('notifications').select('id').eq('id',adminRows[0].id); ok("customer cannot read an admin's notification",peek.data.length===0);
  await s1.from('notifications').insert({recipient_user_id:cu1.id,kind:'x',title:'forged'}); ok('customer cannot create a notification',!(await notifs(cu1.id)).some(x=>x.title==='forged'));
  await s1.from('notifications').update({title:'hacked'}).eq('id',my.data[0].id); ok('customer cannot edit a notification',!(await notifs(cu1.id)).some(x=>x.title==='hacked'));
  const rq=await s1.from('document_requests').select('id'); ok("customer cannot see requests that the REP made (they can carry internal notes)",(rq.data||[]).length===0);
  // 7 mark read
  const unread=(await notifs(cu1.id)).filter(x=>!x.read_at); r=await call('POST','/api/notifications/read',cc1,{ids:[unread[0].id]});
  ok('mark one read',r.status===200&&(await notifs(cu1.id)).find(x=>x.id===unread[0].id).read_at);
  r=await call('POST','/api/notifications/read',cc1,{ids:[adminRows[0].id]}); ok("cannot mark someone else's notification read",!(await notifs(adm.id)).find(x=>x.id===adminRows[0].id).read_at);
  r=await call('POST','/api/notifications/read',cc1,{all:true}); ok('mark all read (own only)',(await notifs(cu1.id)).every(x=>x.read_at)&&(await notifs(adm.id)).some(x=>!x.read_at));
  r=await call('POST','/api/notifications/read',null,{all:true}); ok('signed-out refused',r.status===401);
  // pages
  const rp=await fetch(`http://localhost:10001/rep/orders/${orderId}`,{headers:{Cookie:rc1}}); const h=await rp.text(); ok('rep order page shows the requests + form',rp.status===200&&h.includes('Request a document')&&h.includes('CSA Certificate'));
  const ad=await call('GET',`/api/admin/orders/${orderId}`,ac); const adj=await ad.json(); ok('admin order data lists the requests',adj.requests?.length===2);
}catch(e){console.log('ERROR',e)}finally{
  if(docPath) await a.storage.from('documents').remove([docPath]);
  await a.from('orders').delete().in('customer_id',[c1.id,c2.id]);
  await a.from('customers').delete().in('id',[c1.id,c2.id]);await a.from('reps').delete().in('id',[rep1.id,rep2.id]);
  for(const u of [adm,r1,r2,cu1,cu2]) await a.auth.admin.deleteUser(u.id);
  const {data:left}=await a.from('customers').select('id').like('company_name','ZZ %'); const {data:lu}=(await a.auth.admin.listUsers({perPage:1000}));
  console.log('cleaned; leftover ZZ customers:',left.length,'zz users:',lu.users.filter(u=>(u.email||'').startsWith('zz-')).length);
}
