// End-to-end test (dev database + running dev server). Run from the project root: node scripts/e2e/replications.test.mjs
// Needs dev-schema-replications.sql, dev-patch-replication-code.sql and dev-patch-replication-rep-side.sql applied to the DEV project, `npm run dev` running, and .env.local.
// Creates throwaway 'zz-' accounts and a 'ZZ' request and removes them at the end.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module'; const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const anon=createClient(U,A,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x); const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,m)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(m?{app_metadata:m}:{})})).data.user;
const adm=await mk(`zz-ra-${t}@yopmail.com`,{role:'admin'}), rep=await mk(`zz-rr-${t}@yopmail.com`,{role:'rep'}), cus=await mk(`zz-rc-${t}@yopmail.com`);
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const r=await sb.auth.signInWithPassword({email:e,password:pw});if(r.error)throw r.error;return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(m,url,ck,body,raw)=>fetch('http://localhost:10001'+url,{method:m,headers:{...(raw?{}:{'Content-Type':'application/json'}),...(ck?{Cookie:ck}:{})},body:raw?body:(body?JSON.stringify(body):undefined),redirect:'manual'});
const BASE='/api/replications'; let id, paths=[];
// tiny valid images
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const photo=(buf=PNG,type='image/png',name='p.png')=>{const f=new FormData();f.append('photo',new Blob([buf],{type}),name);return f};
try{
  const ac=await cookie(adm.email), rc=await cookie(rep.email), cc=await cookie(cus.email);

  // --- customers and signed-out visitors are never let in (sales reps are covered by replications-rep.test.mjs)
  for(const [n,ck] of [['signed-out',null],['customer',cc]]){
    const calls=[['GET',BASE],['GET',`${BASE}/x1`],['GET',`${BASE}/RQ-0001`],['POST',BASE,{clientName:'ZZ',productName:'ZZ'}],['PUT',`${BASE}/x1`,{clientName:'ZZ',productName:'ZZ'}],['DELETE',`${BASE}/x1`],['POST',`${BASE}/x1/photos`,photo(),true]];
    let blocked=true; for(const [m,u,b,raw] of calls){const x=await call(m,u,ck,b,raw); if(x.status!==401&&x.status!==403) blocked=false;}
    ok(`${n} is refused on every replication route`,blocked);
    const x=await call('POST','/api/analyze-garment',ck,{replicationId:'x1'}); ok(`${n} cannot run the garment analysis`,x.status===401||x.status===403);
  }

  // --- create / validate
  let r=await call('POST',BASE,ac,{clientName:'',productName:'ZZ'}); ok('a request without a customer name is refused',r.status===400);
  r=await call('POST',BASE,ac,{clientName:'ZZ Customer',productName:'ZZ Parka',garmentType:'spaceship',status:'bogus'}); let j=await r.json();
  ok('admin creates a request',r.status===200&&!!j.replication?.id,j.error||''); id=j.replication?.id;
  ok('unknown garment type and status fall back',j.replication?.garmentType==='jacket'&&j.replication?.status==='received');
  r=await call('GET',BASE,ac); j=await r.json(); ok('admin lists requests',r.status===200&&j.replications.some(x=>x.id===id));
  const code=j.replications.find(x=>x.id===id)?.requestCode;
  r=await call('GET',`${BASE}/${id}`,ac); j=await r.json(); ok('admin opens one request by its id',r.status===200&&j.replication?.id===id,j.error||'');
  r=await call('GET',`${BASE}/${code}`,ac); j=await r.json(); ok('admin opens one request by its RQ number',r.status===200&&j.replication?.id===id,code);
  r=await call('GET',`${BASE}/RQ-99999999`,ac); ok('an unknown RQ number gives 404',r.status===404);
  r=await call('GET',`${BASE}/zz-none`,ac); ok('an unknown id gives 404',r.status===404);
  r=await call('GET',`${BASE}/bad%20id!`,ac); ok('an unsafe id is refused on read',r.status===400);

  // --- photos: private, only real images
  const bad=new FormData(); bad.append('photo',new Blob(['not an image'],{type:'image/png'}),'fake.png');
  r=await call('POST',`${BASE}/${id}/photos`,ac,bad,true); ok('a file that is not an image is refused',r.status===400);
  r=await call('POST',`${BASE}/${id}/photos`,ac,photo(),true); j=await r.json(); ok('admin adds a photo',r.status===200&&j.replication?.images?.length===1,j.error||'');
  r=await call('POST',`${BASE}/${id}/photos`,ac,photo(),true); j=await r.json(); ok('and a second one',j.replication?.images?.length===2);
  paths=j.replication?.imagePaths||[]; ok('photos are stored under the request',paths.length===2&&paths.every(p=>p.startsWith(id+'/')));
  const url=j.replication?.images?.[0]; if(url){const f=await fetch(url); ok('the private link serves the photo',f.status===200);}
  const pub=await fetch(`${U}/storage/v1/object/public/replication-photos/${paths[0]}`); ok('photos have no public address',pub.status>=400);
  const bk=await anon.storage.from('replication-photos').download(paths[0]); ok('public key cannot download a photo',!!bk.error);
  r=await call('POST',`${BASE}/zz-none/photos`,ac,photo(),true); ok('a photo for a missing request gives 404',r.status===404);

  // --- save: status, messages, AI analysis, photo order (and no foreign photo paths)
  const analysis={garmentClass:'parka',measurements:[{pom:'A',description:'Chest',xs:'20',s:'21',m:'22',l:'23',xl:'24',tolerance:'0.5'}],analyzedAt:new Date().toISOString()};
  const full=(over={})=>({clientName:'ZZ Customer',productName:'ZZ Parka',garmentType:'parka',imagePaths:[paths[1],paths[0],'other-request/evil.png'],aiAnalysis:analysis,messages:[{id:'m1',sender:'admin',senderName:'RIVIX',message:'hello',timestamp:new Date().toISOString()},{id:'m2',message:'no timestamp'}],rivixTrackingCarrier:'DHL Express',rivixTrackingNumber:'123',...over});
  r=await call('PUT',`${BASE}/${id}`,ac,full({status:'spec_mapped'})); j=await r.json(); ok('moving past Received without an approved review is refused',r.status===400&&/approve/i.test(j.error||''),j.error||'');
  r=await call('PUT',`${BASE}/${id}`,ac,full({status:'received'})); j=await r.json();
  ok('admin saves changes (still Received, draft)',r.status===200&&j.replication?.status==='received'&&j.replication?.garmentType==='parka'&&j.replication?.aiAnalysis?.review?.status==='draft',j.error||'');
  ok('photo order is saved and a foreign path is dropped',JSON.stringify(j.replication?.imagePaths)===JSON.stringify([paths[1],paths[0]]));
  ok('the AI analysis is saved with the request',j.replication?.aiAnalysis?.garmentClass==='parka'&&j.replication.aiAnalysis.measurements?.[0]?.m==='22');
  ok('the old in-row chat is no longer used (the chat has its own table), and sending one does not crash',r.status===200&&(j.replication?.messages||[]).length===0);
  ok('a readable request code is returned',/^RQ-/.test(j.replication?.requestCode||''),j.replication?.requestCode);
  // --- approval
  r=await call('PUT',`${BASE}/${id}`,ac,full({status:'received',approve:true,aiAnalysis:{...analysis,measurements:[]}})); ok('approving with no measurements is refused',r.status===400);
  r=await call('PUT',`${BASE}/${id}`,ac,full({status:'received',approve:true,aiAnalysis:{...analysis,measurements:[{pom:'',description:'',xs:'',s:'',m:'',l:'',xl:'',tolerance:''}]}})); ok('approving a row without a code or description is refused',r.status===400);
  r=await call('PUT',`${BASE}/${id}`,ac,full({status:'received',approve:true,aiAnalysis:{...analysis,review:{status:'approved',approvedBy:'someone else'}}})); j=await r.json();
  ok('approving works and moves Received to Mapped',r.status===200&&j.replication?.status==='spec_mapped'&&j.replication?.aiAnalysis?.review?.status==='approved',j.error||'');
  ok('who approved is the signed-in admin, not what the browser sent',/^zz-ra-/.test(j.replication?.aiAnalysis?.review?.approvedBy||''),j.replication?.aiAnalysis?.review?.approvedBy);
  ok('the first approval is revision 1',j.replication?.aiAnalysis?.review?.revision===1,String(j.replication?.aiAnalysis?.review?.revision));
  const approvedAt=j.replication?.aiAnalysis?.review?.approvedAt;
  r=await call('PUT',`${BASE}/${id}`,ac,full({status:'spec_mapped',aiAnalysis:j.replication.aiAnalysis})); j=await r.json();
  ok('saving unchanged keeps the approval (e.g. a chat message)',r.status===200&&j.replication?.aiAnalysis?.review?.status==='approved'&&j.replication.aiAnalysis.review.approvedAt===approvedAt);
  r=await call('PUT',`${BASE}/${id}`,ac,full({status:'sample_production',aiAnalysis:j.replication.aiAnalysis})); j=await r.json(); ok('an approved request can start production',r.status===200&&j.replication?.status==='sample_production',j.error||'');
  r=await call('PUT',`${BASE}/${id}`,ac,full({status:'sample_production',aiAnalysis:{...j.replication.aiAnalysis,measurements:[{...analysis.measurements[0],m:'99'}]}})); j=await r.json();
  ok('changing the draft after approval makes it a draft again',r.status===200&&j.replication?.aiAnalysis?.review?.status==='draft');
  ok('a draft keeps the last approved revision number',j.replication?.aiAnalysis?.review?.revision===1);
  r=await call('PUT',`${BASE}/${id}`,ac,full({status:'sample_production',approve:true,aiAnalysis:j.replication.aiAnalysis})); j=await r.json(); ok('approving again makes revision 2',r.status===200&&j.replication?.aiAnalysis?.review?.revision===2&&j.replication?.aiAnalysis?.review?.status==='approved',j.error||'');
  r=await call('PUT',`${BASE}/${id}`,ac,full({status:'sample_production',aiAnalysis:{...j.replication.aiAnalysis,measurements:[{...analysis.measurements[0],m:'98'}]}})); j=await r.json();
  r=await call('PUT',`${BASE}/${id}`,ac,full({status:'sample_shipped',aiAnalysis:j.replication.aiAnalysis})); ok('a draft cannot be shipped',r.status===400);
  r=await call('GET',BASE,ac); j=await r.json(); const got=j.replications.find(x=>x.id===id); ok('it all survives a reload',got?.status==='sample_production'&&got?.aiAnalysis?.garmentClass==='parka'&&got?.rivixTrackingNumber==='123');
  const cnt=await a.from('replications').select('id').eq('id',id); ok('exactly one row exists',cnt.data.length===1);
  r=await call('PUT',`${BASE}/${id}`,ac,{clientName:'ZZ Customer',productName:'ZZ Parka',imagePaths:[paths[0]]}); j=await r.json(); ok('leaving a photo out removes it',j.replication?.images?.length===1);
  const gonePhoto=await a.storage.from('replication-photos').download(paths[1]); ok('the removed photo file is deleted from storage',!!gonePhoto.error);
  r=await call('PUT',`${BASE}/bad%20id!`,ac,{clientName:'ZZ',productName:'ZZ'}); ok('an unsafe id is refused',r.status===400);
  r=await call('PUT',`${BASE}/zz-none`,ac,{clientName:'ZZ',productName:'ZZ'}); ok('saving a missing request gives 404',r.status===404);

  // --- inbound parcel (what the customer posts to RIVIX): saved with the request, received date kept in specs
  r=await call('PUT',`${BASE}/${id}`,ac,full({status:'received',aiAnalysis:j?.replication?.aiAnalysis??analysis,clientTrackingCarrier:'UPS',clientTrackingNumber:'1Z999AA10123456784',specs:{annotations:[],inboundReceivedAt:'2026-10-19T12:00:00.000Z'}})); j=await r.json();
  ok('an inbound parcel and its received date are saved',r.status===200&&j.replication?.clientTrackingNumber==='1Z999AA10123456784'&&j.replication?.specs?.inboundReceivedAt==='2026-10-19T12:00:00.000Z',j.error||'');
  r=await call('PUT',`${BASE}/${id}`,ac,full({status:'received',aiAnalysis:j.replication?.aiAnalysis,clientTrackingCarrier:'',clientTrackingNumber:'',specs:{annotations:[]}})); j=await r.json();
  ok('removing the inbound parcel clears it',r.status===200&&!j.replication?.clientTrackingNumber&&!j.replication?.specs?.inboundReceivedAt,j.error||'');

  // --- the table is not reachable from the browser key
  const direct=await anon.from('replications').select('id').eq('id',id); ok('public key cannot read requests',!direct.data||direct.data.length===0);
  const w=await anon.from('replications').insert({id:'zz-anon-'+t,client_name:'hack',product_name:'hack'}); ok('public key cannot write requests',!!w.error);

  // --- delete removes the row and the files
  r=await call('DELETE',`${BASE}/${id}`,ac); ok('admin deletes the request',r.status===200);
  const gone=await a.from('replications').select('id').eq('id',id); ok('row removed',gone.data.length===0);
  const f2=await a.storage.from('replication-photos').download(paths[0]); ok('photo files removed',!!f2.error);
  r=await call('DELETE',`${BASE}/${id}`,ac); ok('deleting twice gives 404',r.status===404);
}catch(e){console.log('ERROR',e)}finally{
  if(id) await a.from('replications').delete().eq('id',id);
  if(paths.length) await a.storage.from('replication-photos').remove(paths);
  for(const u of [adm,rep,cus]) await a.auth.admin.deleteUser(u.id);console.log('cleaned');
}
