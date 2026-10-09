// End-to-end test (dev database + running dev server). Run from the project root: node scripts/e2e/customer-requests.test.mjs
// Creates throwaway 'zz-' accounts and removes them at the end. Needs `npm run dev` running and .env.local.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module'; const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x); const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,m)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(m?{app_metadata:m}:{})})).data.user;
const adm=await mk(`zz-qa-${t}@yopmail.com`,{role:'admin'}), r1=await mk(`zz-qr1-${t}@yopmail.com`,{role:'rep'}), r2=await mk(`zz-qr2-${t}@yopmail.com`,{role:'rep'}), cu1=await mk(`zz-qc1-${t}@yopmail.com`), cu2=await mk(`zz-qc2-${t}@yopmail.com`), cu3=await mk(`zz-qc3-${t}@yopmail.com`);
const {data:rep1}=await a.from('reps').insert({name:'ZZ Q1',email:r1.email,user_id:r1.id}).select().single();
const {data:rep2}=await a.from('reps').insert({name:'ZZ Q2',email:r2.email,user_id:r2.id}).select().single();
const {data:c1}=await a.from('customers').insert({user_id:cu1.id,company_name:'ZZ Req One',contact_email:cu1.email,customer_code:'',rep_id:rep1.id}).select().single();
const {data:c2}=await a.from('customers').insert({user_id:cu2.id,company_name:'ZZ Req Two',contact_email:cu2.email,customer_code:'',rep_id:rep2.id}).select().single();
const {data:c3}=await a.from('customers').insert({user_id:cu3.id,company_name:'ZZ No Rep',contact_email:cu3.email,customer_code:''}).select().single();
const mkOrder=async(c,rep,status)=>(await a.from('orders').insert({customer_id:c.id,rep_id:rep?.id||null,batch_number:'',product_name:'Req test',quantity:1,...(status?{status}:{})}).select().single()).data;
const o1=await mkOrder(c1,rep1,'Shipped'), oc=await mkOrder(c1,rep1,'Cancelled'), o3=await mkOrder(c3,null,'Delivered'), oe=await mkOrder(c1,rep1,'In Production');
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const r=await sb.auth.signInWithPassword({email:e,password:pw});if(r.error)throw r.error;return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(m,url,ck,body)=>fetch('http://localhost:10001'+url,{method:m,headers:{'Content-Type':'application/json',...(ck?{Cookie:ck}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
const notifs=async uid=>(await a.from('notifications').select('*').eq('recipient_user_id',uid)).data||[];
const reqs=async oid=>(await a.from('document_requests').select('*').eq('order_id',oid).order('created_at')).data||[];
let docPath;
try{
  const ac=await cookie(adm.email), rc1=await cookie(r1.email), rc2=await cookie(r2.email), cc1=await cookie(cu1.email), cc2=await cookie(cu2.email), cc3=await cookie(cu3.email);
  // customer -> rep
  let r=await call('POST',`/api/portal/orders/${o1.id}/document-requests`,cc1,{doc_type:'CSA Certificate',note:'Need before shipping'}); let j=await r.json();
  ok('customer sends a request, it goes to the rep',r.status===201&&j.to==='rep',JSON.stringify(j));
  let rows=await reqs(o1.id); ok('saved as a customer request waiting for the rep',rows.length===1&&rows[0].requested_by==='customer'&&rows[0].status==='pending_rep'&&rows[0].rep_id===rep1.id);
  const rn=(await notifs(r1.id)).find(x=>x.kind==='customer_request'); ok('rep notified, link opens the rep order page',rn&&rn.link===`/rep/orders/${o1.id}`&&rn.body.includes('CSA Certificate')&&rn.body.includes('Need before shipping'),rn?.title);
  ok('admin NOT notified yet',!(await notifs(adm.id)).some(x=>x.order_id===o1.id));
  r=await call('POST',`/api/portal/orders/${o1.id}/document-requests`,cc1,{doc_type:'CSA Certificate'}); ok('same type again is refused',r.status===409);
  r=await call('POST',`/api/portal/orders/${oc.id}/document-requests`,cc1,{doc_type:'Other'}); ok('cancelled order refused',r.status===400);
  r=await call('POST',`/api/portal/orders/${oe.id}/document-requests`,cc1,{doc_type:'Other'}); j=await r.json(); ok('order still in production refused (only Shipped/Delivered allowed)',r.status===400&&/shipped/.test(j.error),j.error);
  ok('  and nothing was saved',(await reqs(oe.id)).length===0);
  r=await call('POST',`/api/portal/orders/${o1.id}/document-requests`,cc2,{doc_type:'Other'}); ok("another customer can't request on someone else's order",r.status===404);
  r=await call('POST',`/api/portal/orders/${o1.id}/document-requests`,rc1,{doc_type:'Other'}); ok('a rep cannot use the customer route',r.status===403);
  r=await call('POST',`/api/portal/orders/${o1.id}/document-requests`,null,{doc_type:'Other'}); ok('signed-out refused',r.status===401);
  // visibility
  const s1=createClient(U,A,{auth:{persistSession:false}}); await s1.auth.signInWithPassword({email:cu1.email,password:pw});
  const s2=createClient(U,A,{auth:{persistSession:false}}); await s2.auth.signInWithPassword({email:cu2.email,password:pw});
  ok('customer sees their own request',(await s1.from('document_requests').select('id,status')).data.length===1);
  ok('another customer sees none',(await s2.from('document_requests').select('id')).data.length===0);
  await s1.from('document_requests').update({status:'done'}).eq('id',rows[0].id); ok('customer cannot change a request',(await reqs(o1.id))[0].status==='pending_rep');
  await s1.from('document_requests').insert({order_id:o1.id,customer_id:c1.id,doc_type:'Other'}); ok('customer cannot create a request row directly',(await reqs(o1.id)).length===1);
  await a.from('document_requests').insert({order_id:o1.id,customer_id:c1.id,rep_id:rep1.id,doc_type:'Other',note:'INTERNAL rep note',requested_by:'rep',status:'open'});
  const mine=(await s1.from('document_requests').select('requested_by,note')).data; ok("customer sees only requests THEY made, never a rep's internal one",mine.length===1&&mine.every(x=>x.requested_by==='customer'&&!(x.note||'').includes('INTERNAL')),JSON.stringify(mine.map(x=>x.requested_by)));
  await a.from('document_requests').delete().eq('order_id',o1.id).eq('requested_by','rep');
  // rep forwards
  r=await call('PATCH',`/api/rep/document-requests/${rows[0].id}`,rc2,{action:'forward'}); ok("another rep cannot act on it",r.status===404);
  r=await call('PATCH',`/api/rep/document-requests/${rows[0].id}`,cc1,{action:'forward'}); ok('customer cannot forward',r.status===403);
  r=await call('PATCH',`/api/rep/document-requests/${rows[0].id}`,rc1,{action:'bogus'}); ok('unknown action refused',r.status===400);
  r=await call('PATCH',`/api/rep/document-requests/${rows[0].id}`,rc1,{action:'forward'}); ok('rep sends it to admin',r.status===200);
  rows=await reqs(o1.id); ok('status is now open (with admin)',rows[0].status==='open');
  const an=(await notifs(adm.id)).find(x=>x.kind==='document_request'&&x.order_id===o1.id); ok('admin notified, with type and note',an&&an.body.includes('CSA Certificate')&&an.link===`/admin/orders/${o1.id}`,an?.title);
  const cn=(await notifs(cu1.id)).find(x=>x.kind==='request_update'); ok('customer told it is being handled',cn&&cn.title.includes('being handled'),cn?.title);
  r=await call('PATCH',`/api/rep/document-requests/${rows[0].id}`,rc1,{action:'forward'}); ok('cannot be handled twice',r.status===409);
  // dismiss path
  await call('POST',`/api/portal/orders/${o1.id}/document-requests`,cc1,{doc_type:'Test Report'});
  const tr=(await reqs(o1.id)).find(x=>x.doc_type==='Test Report'); r=await call('PATCH',`/api/rep/document-requests/${tr.id}`,rc1,{action:'dismiss'}); ok('rep dismisses a request',r.status===200&&(await reqs(o1.id)).find(x=>x.id===tr.id).status==='dismissed');
  ok('customer told it was closed',(await notifs(cu1.id)).some(x=>x.kind==='request_update'&&x.title.includes('About your document request')));
  r=await call('POST',`/api/portal/orders/${o1.id}/document-requests`,cc1,{doc_type:'Test Report'}); ok('after dismissing, the customer may ask again',r.status===201);
  // no rep -> admin directly
  r=await call('POST',`/api/portal/orders/${o3.id}/document-requests`,cc3,{doc_type:'Other'}); j=await r.json(); ok('customer with no rep: goes straight to admin',r.status===201&&j.to==='admin');
  ok('  saved as open and admin notified',(await reqs(o3.id))[0].status==='open'&&(await notifs(adm.id)).some(x=>x.order_id===o3.id&&x.kind==='document_request'));
  // admin upload closes a pending customer request of that type
  await call('POST',`/api/portal/orders/${o1.id}/document-requests`,cc1,{doc_type:'Fabric Detail Sheet'});
  const content=Buffer.from('%PDF-1.4 req test '+t);
  r=await call('POST',`/api/admin/orders/${o1.id}/documents/upload-url`,ac,{file_name:'fabric.pdf',size:content.length,mime:'application/pdf'}); j=await r.json(); docPath=j.path;
  await createClient(U,A,{auth:{persistSession:false}}).storage.from('documents').uploadToSignedUrl(j.path,j.token,content,{contentType:'application/pdf'});
  r=await call('POST',`/api/admin/orders/${o1.id}/documents`,ac,{path:j.path,file_name:'fabric.pdf',title:'Fabric',doc_type:'Fabric Detail Sheet'}); ok('admin uploads that document type',r.status===201);
  ok('the pending customer request closed by itself',(await reqs(o1.id)).find(x=>x.doc_type==='Fabric Detail Sheet').status==='done');
  // pages
  const cp=await fetch(`http://localhost:10001/portal/orders/${o1.batch_number}`,{headers:{Cookie:cc1}}); ok('customer order page loads',cp.status===200);
  const rp=await fetch(`http://localhost:10001/rep/orders/${o1.id}`,{headers:{Cookie:rc1}}); const h=await rp.text(); ok('rep order page shows the customer request',rp.status===200&&h.includes('from customer'));
}catch(e){console.log('ERROR',e)}finally{
  if(docPath) await a.storage.from('documents').remove([docPath]);
  await a.from('orders').delete().in('customer_id',[c1.id,c2.id,c3.id]); await a.from('customers').delete().in('id',[c1.id,c2.id,c3.id]); await a.from('reps').delete().in('id',[rep1.id,rep2.id]);
  const {data:l}=await a.auth.admin.listUsers({perPage:1000}); for(const u of l.users) if((u.email||'').startsWith('zz-')) await a.auth.admin.deleteUser(u.id);
  const {data:lc}=await a.from('customers').select('id').like('company_name','ZZ %'); const {data:lr}=await a.from('reps').select('id').like('name','ZZ %'); const {data:l2}=await a.auth.admin.listUsers({perPage:1000});
  console.log('cleaned; leftovers — customers:',lc.length,'reps:',lr.length,'users:',l2.users.filter(u=>(u.email||'').startsWith('zz-')).length);
}
