// End-to-end test (dev database + running dev server). Run from the project root: node scripts/e2e/replications-rep.test.mjs
// The Replication Queue is an internal tool between sales reps and admins (customers are never connected to it).
// Checks: a rep only sees and changes their own requests, cannot approve / ship / delete, the rep<->admin chat,
// notifications, the admin-only download log, and that customers get nowhere.
// Needs dev-patch-replication-rep-side.sql applied to the DEV project. Creates throwaway 'zz-' accounts and removes them.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module'; const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x); const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,m)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(m?{app_metadata:m}:{})})).data.user;
const admU=await mk(`zz-pa-${t}@yopmail.com`,{role:'admin'}), repAU=await mk(`zz-pra-${t}@yopmail.com`,{role:'rep'}), repBU=await mk(`zz-prb-${t}@yopmail.com`,{role:'rep'}), cusU=await mk(`zz-pc-${t}@yopmail.com`);
const {data:repA}=await a.from('reps').insert({name:'ZZ Rep Alpha',email:repAU.email,user_id:repAU.id}).select().single();
const {data:repB}=await a.from('reps').insert({name:'ZZ Rep Beta',email:repBU.email,user_id:repBU.id}).select().single();
const {data:repOff}=await a.from('reps').insert({name:'ZZ Rep Off',email:`zz-poff-${t}@yopmail.com`,active:false}).select().single();
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const r=await sb.auth.signInWithPassword({email:e,password:pw});if(r.error)throw r.error;return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(m,url,ck,body,raw)=>fetch('http://localhost:10001'+url,{method:m,headers:{...(raw?{}:{'Content-Type':'application/json'}),...(ck?{Cookie:ck}:{})},body:raw?body:(body?JSON.stringify(body):undefined),redirect:'manual'});
const B='/api/replications'; const ids=[]; let pathsToClean=[];
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const photo=()=>{const f=new FormData();f.append('photo',new Blob([PNG],{type:'image/png'}),'p.png');return f};
const analysis={garmentClass:'coverall',measurements:[{pom:'A',description:'Chest',xs:'1',s:'2',m:'3',l:'4',xl:'5',tolerance:'0.5'}],analyzedAt:new Date().toISOString()};
try{
  const ad=await cookie(admU.email), ra=await cookie(repAU.email), rb=await cookie(repBU.email), cu=await cookie(cusU.email);

  // --- an expired sign-in token is refreshed, and the new one is sent back to the browser (no more random "Unauthorized")
  {
    const parts=ra.split('; '); const [ckName,...ckRest]=parts[0].split('='); const raw=ckRest.join('=');
    const sess=JSON.parse(Buffer.from(raw.replace(/^base64-/,''),'base64url').toString());
    const stale='base64-'+Buffer.from(JSON.stringify({...sess,expires_at:1,access_token:'expired.invalid.token'})).toString('base64url');
    const x=await call('GET',B,`${ckName}=${stale}`); const setCookies=x.headers.getSetCookie?.()||[];
    ok('a rep whose sign-in token has expired still gets through',x.status===200,String(x.status));
    ok('and the refreshed sign-in is sent back to the browser',setCookies.some(c=>c.startsWith(ckName)&&!c.includes('expired.invalid.token')),setCookies.length+' cookies');
  }

  // --- a rep creates a request: it is theirs, whatever the browser claims
  let r=await call('POST',B,ra,{clientName:'ZZ Prospect',productName:'ZZ Rep Parka',garmentType:'parka',repId:repB.id}); let j=await r.json();
  const A1=j.replication?.id; ids.push(A1);
  ok('a rep creates a request',r.status===200&&!!A1,j.error||'');
  ok("the request belongs to that rep (a repId sent by a rep is ignored)",j.replication?.repId===repA.id&&j.replication?.repName==='ZZ Rep Alpha'&&j.replication?.createdByRole==='rep',JSON.stringify([j.replication?.repId,j.replication?.repName]));
  const codeA1=j.replication?.requestCode;
  // admin creates one for rep B and one kept by the admin
  r=await call('POST',B,ad,{clientName:'ZZ Other',productName:'ZZ Beta Vest',garmentType:'vest',repId:repB.id}); j=await r.json(); const B1=j.replication?.id; ids.push(B1);
  ok('an admin creates a request for a chosen rep',r.status===200&&j.replication?.repId===repB.id&&j.replication?.createdByRole==='admin',j.error||'');
  r=await call('POST',B,ad,{clientName:'ZZ Direct',productName:'ZZ Admin Coat',garmentType:'coat'}); j=await r.json(); const D1=j.replication?.id; ids.push(D1);
  ok('an admin may keep a request ("handled directly": no rep)',r.status===200&&j.replication?.repId===null&&j.replication?.repName===null);
  r=await call('POST',B,ad,{clientName:'ZZ Bad',productName:'ZZ',repId:repOff.id}); ok('a disabled rep cannot be chosen',r.status===400);

  // --- visibility
  r=await call('GET',B,ra); j=await r.json(); const mine=(j.replications||[]).map(x=>x.id);
  ok("a rep's list holds only their own requests",r.status===200&&mine.includes(A1)&&!mine.includes(B1)&&!mine.includes(D1));
  r=await call('GET',B,ad); j=await r.json(); const all=(j.replications||[]).map(x=>x.id);
  ok('the admin sees all of them, with the rep names',all.includes(A1)&&all.includes(B1)&&all.includes(D1)&&j.replications.find(x=>x.id===A1)?.repName==='ZZ Rep Alpha');
  r=await call('GET',`${B}/${A1}`,ra); ok('a rep opens their own request by id',r.status===200);
  r=await call('GET',`${B}/${codeA1}`,ra); ok('and by its RQ number',r.status===200);
  r=await call('GET',`${B}/${B1}`,ra); ok("a rep cannot open another rep's request",r.status===404);
  r=await call('GET',`${B}/${D1}`,ra); ok('nor one the admin handles directly',r.status===404);
  r=await call('POST',`${B}/${B1}/photos`,ra,photo(),true); ok("a rep cannot add photos to another rep's request",r.status===404);
  r=await call('POST','/api/analyze-garment',ra,{replicationId:B1}); ok("a rep cannot scan another rep's request",r.status===404);
  r=await call('POST','/api/analyze-garment',ra,{images:['data:image/png;base64,AAAA']}); ok('a rep cannot scan loose images',r.status===403);

  // --- what a rep can and cannot change on their own request
  r=await call('POST',`${B}/${A1}/photos`,ra,photo(),true); j=await r.json(); pathsToClean.push(...(j.replication?.imagePaths||[])); ok('a rep adds photos to their own request',r.status===200&&j.replication?.images?.length===1,j.error||'');
  const cur=(await (await call('GET',`${B}/${A1}`,ra)).json()).replication;
  r=await call('PUT',`${B}/${A1}`,ra,{...cur,aiAnalysis:analysis,specs:{...cur.specs,coreMaterial:'Cotton'},status:'sample_shipped',approve:true,repId:repB.id,rivixTrackingCarrier:'DHL',rivixTrackingNumber:'999',clientTrackingNumber:'IN-1',clientTrackingCarrier:'UPS'}); j=await r.json();
  ok('a rep saves the spec and scan result',r.status===200&&j.replication?.specs?.coreMaterial==='Cotton'&&j.replication?.aiAnalysis?.garmentClass==='coverall',j.error||'');
  ok('but cannot move the request, approve it, hand it over or set the dispatch',j.replication?.status==='received'&&j.replication?.aiAnalysis?.review?.status==='draft'&&j.replication?.repId===repA.id&&!j.replication?.rivixTrackingNumber,JSON.stringify([j.replication?.status,j.replication?.aiAnalysis?.review?.status,j.replication?.repId,j.replication?.rivixTrackingNumber]));
  ok('a rep can log the inbound parcel',j.replication?.clientTrackingNumber==='IN-1');
  r=await call('DELETE',`${B}/${A1}`,ra); ok('a rep cannot delete a request',r.status===403);

  // --- download log: admin only
  r=await call('POST',`${B}/${A1}/downloads`,ra,{revision:1,approved:true}); ok('a rep cannot log or make a tech file download',r.status===403);
  r=await call('GET',`${B}/${A1}/downloads`,ra); ok('a rep cannot read the download log',r.status===403);
  r=await call('POST',`${B}/${A1}/downloads`,ad,{revision:2,approved:true}); ok('the admin logs a download',r.status===200);
  r=await call('GET',`${B}/${A1}/downloads`,ad); j=await r.json(); ok('and reads the log (who, revision)',j.downloads?.length===1&&j.downloads[0].by===admU.email&&j.downloads[0].revision===2&&j.downloads[0].role==='admin');

  // --- chat between the rep and the admin
  r=await call('POST',`${B}/${A1}/messages`,ra,{message:'   '}); ok('an empty message is refused',r.status===400);
  r=await call('POST',`${B}/${A1}/messages`,ra,{message:'Customer sent three photos, please review.'}); j=await r.json(); ok('the rep writes to the admin',r.status===200&&j.message?.senderRole==='rep'&&j.message?.senderName==='ZZ Rep Alpha',j.error||'');
  r=await call('POST',`${B}/${A1}/messages`,ad,{message:'Looks good, I will approve it.'}); j=await r.json(); ok('the admin replies',r.status===200&&j.message?.senderRole==='admin'&&j.message?.senderName===admU.email,j.error||'');
  r=await call('GET',`${B}/${A1}/messages`,ra); j=await r.json(); ok('the rep reads both messages, in order, with who wrote them',j.messages?.length===2&&j.messages[0].senderRole==='rep'&&j.messages[1].senderRole==='admin');
  r=await call('GET',`${B}/${A1}/messages`,rb); ok("another rep cannot read it",r.status===404);
  r=await call('POST',`${B}/${A1}/messages`,rb,{message:'hi'}); ok('nor write in it',r.status===404);
  const {data:nAdmin}=await a.from('notifications').select('kind,link,recipient_user_id').eq('recipient_user_id',admU.id).eq('kind','replication_message');
  const {data:nRep}=await a.from('notifications').select('kind,link,recipient_user_id').eq('recipient_user_id',repAU.id).eq('kind','replication_message');
  ok('the admin was notified of the rep message (link opens the admin chat)',nAdmin?.length>=1&&nAdmin.some(n=>n.link.startsWith('/admin/replication/')&&n.link.endsWith('tab=chat')));
  ok('the rep was notified of the admin reply (link opens the rep chat)',nRep?.length===1&&nRep[0].link.startsWith('/rep/replication/')&&nRep[0].link.endsWith('tab=chat'));
  const {data:nNew}=await a.from('notifications').select('kind').eq('recipient_user_id',admU.id).eq('kind','replication_new'); ok('the admin was told when a rep created a request',nNew?.length>=1);
  const {data:nOther}=await a.from('notifications').select('id').eq('recipient_user_id',repBU.id).in('kind',['replication_message']); ok('a different rep got no chat notice',(nOther||[]).length===0);

  // --- admin approves: the rep is told; the admin gives a request to another rep
  r=await call('PUT',`${B}/${A1}`,ad,{...cur,aiAnalysis:analysis,approve:true}); j=await r.json(); ok('the admin approves the rep request',r.status===200&&j.replication?.aiAnalysis?.review?.status==='approved'&&j.replication?.status==='spec_mapped',j.error||'');
  const {data:nAppr}=await a.from('notifications').select('kind').eq('recipient_user_id',repAU.id).eq('kind','replication_approved'); ok('the rep was told it was approved',nAppr?.length===1);
  r=await call('PUT',`${B}/${A1}`,ad,{...j.replication,repId:repB.id}); j=await r.json(); ok('the admin hands the request to another rep',r.status===200&&j.replication?.repId===repB.id&&j.replication?.repName==='ZZ Rep Beta',j.error||'');
  r=await call('GET',`${B}/${A1}`,ra); ok('the first rep no longer sees it',r.status===404);
  r=await call('GET',`${B}/${A1}`,rb); ok('the new rep does',r.status===200);
  r=await call('PUT',`${B}/${A1}`,ad,{...j.replication,repId:''}); j=await r.json(); ok('the admin can take it back ("handled directly")',r.status===200&&j.replication?.repId===null);

  // --- form options
  r=await call('GET',`${B}/lookups`,ad); j=await r.json(); ok('the admin gets the active reps for the form',r.status===200&&j.role==='admin'&&j.reps.some(x=>x.id===repA.id)&&!j.reps.some(x=>x.id===repOff.id));
  r=await call('GET',`${B}/lookups`,ra); j=await r.json(); ok('a rep gets their own name and no rep list',r.status===200&&j.role==='rep'&&j.repName==='ZZ Rep Alpha'&&j.reps.length===0);

  // --- customers and signed-out visitors get nowhere
  for(const [n,ck] of [['signed-out',null],['customer',cu]]){
    const calls=[['GET',B],['POST',B,{clientName:'ZZ',productName:'ZZ'}],['GET',`${B}/${A1}`],['PUT',`${B}/${A1}`,{clientName:'ZZ',productName:'ZZ'}],['DELETE',`${B}/${A1}`],['GET',`${B}/${A1}/messages`],['POST',`${B}/${A1}/messages`,{message:'x'}],['GET',`${B}/${A1}/downloads`],['POST',`${B}/${A1}/downloads`,{}],['GET',`${B}/lookups`]];
    let blocked=true; for(const [m,u,b] of calls){const x=await call(m,u,ck,b); if(x.status!==401&&x.status!==403) blocked=false;}
    ok(`${n} is refused everywhere in the replication tool`,blocked);
  }
  const anon=createClient(U,A,{auth:{persistSession:false}});
  const m1=await anon.from('replication_messages').select('id'); const d1=await anon.from('replication_downloads').select('id');
  ok('the public key cannot read the chat or the download log',(!m1.data||m1.data.length===0)&&(!d1.data||d1.data.length===0));

  // --- deleting a request removes its chat and log; admin only
  r=await call('DELETE',`${B}/${A1}`,ad); ok('the admin deletes the request',r.status===200);
  const {data:left}=await a.from('replication_messages').select('id').eq('replication_id',A1); ok('its chat is gone with it',(left||[]).length===0);
}catch(e){console.log('ERROR',e)}finally{
  for(const i of ids) await a.from('replications').delete().eq('id',i);
  if(pathsToClean.length) await a.storage.from('replication-photos').remove(pathsToClean);
  await a.from('notifications').delete().in('recipient_user_id',[admU.id,repAU.id,repBU.id]);
  // A rep's request or message notifies EVERY admin (including real ones): remove those test notices too.
  await a.from('notifications').delete().like('kind','replication_%').like('body','%ZZ%');
  await a.from('reps').delete().in('id',[repA.id,repB.id,repOff.id]);
  for(const u of [admU,repAU,repBU,cusU]) await a.auth.admin.deleteUser(u.id); console.log('cleaned');
}
