// End-to-end test (dev database + running dev server). Run from the project root: node scripts/e2e/documents.test.mjs
// Creates throwaway 'zz-' accounts and removes them at the end. Needs `npm run dev` running and .env.local.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module'; const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x); const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,m)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(m?{app_metadata:m}:{})})).data.user;
const adm=await mk(`zz-da-${t}@yopmail.com`,{role:'admin'}), r1=await mk(`zz-dr1-${t}@yopmail.com`,{role:'rep'}), r2=await mk(`zz-dr2-${t}@yopmail.com`,{role:'rep'}), cu1=await mk(`zz-dc1-${t}@yopmail.com`), cu2=await mk(`zz-dc2-${t}@yopmail.com`);
const {data:rep1}=await a.from('reps').insert({name:'ZZ R1',email:r1.email,user_id:r1.id}).select().single();
const {data:rep2}=await a.from('reps').insert({name:'ZZ R2',email:r2.email,user_id:r2.id}).select().single();
const {data:c1}=await a.from('customers').insert({user_id:cu1.id,company_name:'ZZ D1',contact_email:cu1.email,customer_code:'',rep_id:rep1.id}).select().single();
const {data:c2}=await a.from('customers').insert({user_id:cu2.id,company_name:'ZZ D2',contact_email:cu2.email,customer_code:'',rep_id:rep2.id}).select().single();
const {data:o}=await a.from('orders').insert({customer_id:c1.id,rep_id:rep1.id,batch_number:'',product_name:'Doc test',quantity:1}).select().single();
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const r=await sb.auth.signInWithPassword({email:e,password:pw});if(r.error)throw r.error;return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(m,url,ck,body)=>fetch('http://localhost:10001'+url,{method:m,headers:{'Content-Type':'application/json',...(ck?{Cookie:ck}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
let docPath;
try{
  const ac=await cookie(adm.email), rc1=await cookie(r1.email), rc2=await cookie(r2.email), cc1=await cookie(cu1.email), cc2=await cookie(cu2.email);
  const content=Buffer.from('%PDF-1.4 fake certificate for testing '+t);
  // --- upload flow
  let r=await call('POST',`/api/admin/orders/${o.id}/documents/upload-url`,ac,{file_name:'CSA cert (final).pdf',size:content.length,mime:'application/pdf'}); let j=await r.json();
  ok('admin gets an upload link',r.status===200&&j.token&&j.path.startsWith(`${c1.id}/${o.id}/`),j.error||'');
  docPath=j.path;
  for(const [n,ck] of [['customer',cc1],['rep',rc1],['signed-out',null]]){
    const x=await call('POST',`/api/admin/orders/${o.id}/documents/upload-url`,ck,{file_name:'a.pdf',size:10,mime:'application/pdf'}); ok(`${n} cannot get an upload link`,x.status===401||x.status>=300);
  }
  r=await call('POST',`/api/admin/orders/${o.id}/documents/upload-url`,ac,{file_name:'x.exe',size:10,mime:'application/x-msdownload'}); ok('program file type rejected',r.status===400);
  r=await call('POST',`/api/admin/orders/${o.id}/documents/upload-url`,ac,{file_name:'big.pdf',size:25*1024*1024,mime:'application/pdf'}); ok('file over 20 MB rejected',r.status===400);
  const sbAnon=createClient(U,A,{auth:{persistSession:false}});
  const up=await sbAnon.storage.from('documents').uploadToSignedUrl(j.path,j.token,content,{contentType:'application/pdf'}); ok('browser uploads straight to storage with the link',!up.error,up.error?.message||'');
  r=await call('POST',`/api/admin/orders/${o.id}/documents`,ac,{path:'someone-else/other/evil.pdf',file_name:'evil.pdf',title:'x',doc_type:'Other'}); ok('path outside this order rejected',r.status===400);
  r=await call('POST',`/api/admin/orders/${o.id}/documents`,ac,{path:`${c1.id}/${o.id}/never-uploaded.pdf`,file_name:'n.pdf',title:'x',doc_type:'Other'}); ok('record for a file that never arrived rejected',r.status===400);
  r=await call('POST',`/api/admin/orders/${o.id}/documents`,ac,{path:j.path,file_name:'CSA cert (final).pdf',title:'CSA Certificate - jackets',doc_type:'CSA Certificate'}); j=await r.json(); ok('document recorded',r.status===201&&j.id,j.error||'');
  const docId=j.id;
  const {data:row}=await a.from('documents').select('*').eq('id',docId).single();
  ok('record has right customer, order, type, size, uploader',row.customer_id===c1.id&&row.order_id===o.id&&row.doc_type==='CSA Certificate'&&row.file_size===content.length&&row.uploaded_by===adm.email,JSON.stringify([row.file_size,content.length]));
  // --- download permissions
  for(const [n,ck,expect] of [['admin',ac,200],['owning customer',cc1,200],['owning rep',rc1,200],['other customer',cc2,404],['other rep',rc2,404],['signed-out',null,401]]){
    const x=await call('GET',`/api/documents/${docId}/file`,ck); ok(`${n} -> ${expect}`,x.status===expect,x.status);
    if(expect===200){ const jj=await x.json(); const f=await fetch(jj.url); const buf=Buffer.from(await f.arrayBuffer()); ok(`  ${n}: link returns the real file`,f.status===200&&buf.equals(content)); }
  }
  // --- row security / direct storage
  const sc1=createClient(U,A,{auth:{persistSession:false}}); await sc1.auth.signInWithPassword({email:cu1.email,password:pw});
  const sc2=createClient(U,A,{auth:{persistSession:false}}); await sc2.auth.signInWithPassword({email:cu2.email,password:pw});
  const s1=await sc1.from('documents').select('id'); const s2=await sc2.from('documents').select('id');
  ok('customer 1 sees own document in the list',s1.data.length===1); ok('customer 2 sees none',s2.data.length===0);
  const dl=await sc1.storage.from('documents').download(docPath); ok("customer cannot read the file straight from storage (only via our checked link)",!!dl.error);
  const ins=await sc1.from('documents').insert({customer_id:c1.id,title:'forged',file_path:'x',file_name:'x'}); ok('customer cannot create a document record',!!ins.error);
  const del=await sc1.from('documents').delete().eq('id',docId); const still=await a.from('documents').select('id').eq('id',docId); ok('customer cannot delete a document',still.data.length===1);
  // --- pages render with the document
  const od=await fetch(`http://localhost:10001/admin/orders/${o.id}`,{headers:{Cookie:ac}}); ok('admin order page 200',od.status===200);
  const ad=await call('GET',`/api/admin/orders/${o.id}`,ac); const adj=await ad.json(); ok('admin order data includes the document',adj.documents?.length===1&&adj.documents[0].title==='CSA Certificate - jackets');
  const rp=await fetch(`http://localhost:10001/rep/orders/${o.id}`,{headers:{Cookie:rc1}}); const rh=await rp.text(); ok('rep order page lists the document',rp.status===200&&rh.includes('CSA Certificate - jackets'));
  // --- delete
  for(const [n,ck] of [['customer',cc1],['rep',rc1]]){ const x=await call('DELETE',`/api/admin/documents/${docId}`,ck); ok(`${n} cannot delete via admin route`,x.status===401||x.status>=300); }
  r=await call('DELETE',`/api/admin/documents/${docId}`,ac); ok('admin deletes document',r.status===200);
  const gone=await a.from('documents').select('id').eq('id',docId); ok('record removed',gone.data.length===0);
  const f2=await a.storage.from('documents').download(docPath); ok('stored file removed',!!f2.error);
}catch(e){console.log('ERROR',e)}finally{
  if(docPath) await a.storage.from('documents').remove([docPath]);
  await a.from('orders').delete().eq('customer_id',c1.id);await a.from('customers').delete().in('id',[c1.id,c2.id]);await a.from('reps').delete().in('id',[rep1.id,rep2.id]);
  for(const u of [adm,r1,r2,cu1,cu2]) await a.auth.admin.deleteUser(u.id);console.log('cleaned');
}
