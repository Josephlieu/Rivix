// Task 33: tech files are ADMIN ONLY. A sales rep keeps their request, its photos, its status, the inbound parcel and the
// chat, but never receives the AI draft, the measurements or any spec detail, cannot run the AI scan and cannot download
// the tech file, even by calling the routes directly. The admin still can.
// Run on DEV only, with `EMAIL_DRY_RUN=1 npm run dev` running:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/tech-file-admin-only.test.mjs
// No Gemini quota is used. Creates throwaway 'zz-' accounts and removes them at the end.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module'; const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x); const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,m)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(m?{app_metadata:m}:{})})).data.user;
const admU=await mk(`zz-tf-a-${t}@yopmail.com`,{role:'admin'}), repU=await mk(`zz-tf-r-${t}@yopmail.com`,{role:'rep'});
const {data:rep}=await a.from('reps').insert({name:'ZZ TF Rep',email:repU.email,user_id:repU.id}).select().single();
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const r=await sb.auth.signInWithPassword({email:e,password:pw});if(r.error)throw r.error;return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(m,url,ck,body,raw)=>fetch('http://localhost:10001'+url,{method:m,headers:{...(raw?{}:{'Content-Type':'application/json'}),...(ck?{Cookie:ck}:{})},body:raw?body:(body?JSON.stringify(body):undefined),redirect:'manual'});
const B='/api/replications'; const ids=[]; const pathsToClean=[];
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
const photo=()=>{const f=new FormData();f.append('photo',new Blob([PNG],{type:'image/png'}),'p.png');return f};
// Distinctive values, so the test can look for them anywhere in a raw response.
const SECRET_MEASURE=`ZZMEASURE${t}`, SECRET_FABRIC=`ZZFABRIC${t}`, SECRET_ZIP=`ZZZIPPER${t}`, SECRET_NOTE=`ZZNOTE${t}`;
const analysis={garmentClass:'parka',fabricAnalysis:{material:SECRET_FABRIC},measurements:[{pom:'A',description:SECRET_MEASURE,xs:'1',s:'2',m:'3',l:'4',xl:'5',tolerance:'0.5'}],analyzedAt:new Date().toISOString()};
const adminSpecs={coreMaterial:SECRET_FABRIC,zippers:SECRET_ZIP,specialInstructions:SECRET_NOTE,annotations:[{x:1,y:2,title:SECRET_ZIP}],garmentPosted:true};
const leaks=txt=>[SECRET_MEASURE,SECRET_FABRIC,SECRET_ZIP,SECRET_NOTE].filter(s=>txt.includes(s));
const saved=async id=>(await a.from('replications').select('ai_analysis,specs,images,client_tracking_number').eq('id',id).single()).data;
try{
  const ad=await cookie(admU.email), rc=await cookie(repU.email);

  // --- the admin makes a request for the rep, adds a photo, saves a full draft and spec, and approves it
  let r=await call('POST',B,ad,{clientName:'ZZ TF Client',productName:'ZZ TF Parka',garmentType:'parka',repId:rep.id}); let j=await r.json();
  const id=j.replication?.id, code=j.replication?.requestCode; ids.push(id);
  ok('the admin creates a request for the rep',r.status===200&&!!id,j.error||'');
  for(let i=0;i<2;i++){ r=await call('POST',`${B}/${id}/photos`,ad,photo(),true); j=await r.json(); }
  pathsToClean.push(...(j.replication?.imagePaths||[]));
  ok('two photos added',j.replication?.imagePaths?.length===2);
  r=await call('PUT',`${B}/${id}`,ad,{...j.replication,specs:adminSpecs,aiAnalysis:analysis,approve:true}); j=await r.json();
  ok('the admin saves and approves the tech file',r.status===200&&j.replication?.aiAnalysis?.review?.status==='approved'&&j.replication?.specs?.zippers===SECRET_ZIP,j.error||'');

  // --- what the rep receives
  for(const [n,url] of [['by id',`${B}/${id}`],['by RQ number',`${B}/${code}`],['in the list',B]]){
    r=await call('GET',url,rc); const txt=await r.text(); j=JSON.parse(txt);
    const rec=j.replication||(j.replications||[]).find(x=>x.id===id);
    ok(`rep ${n}: the request is there`,r.status===200&&!!rec);
    ok(`rep ${n}: no AI draft, no measurements, no spec details anywhere in the response`,rec&&rec.aiAnalysis===null&&leaks(txt).length===0,leaks(txt).join(','));
    ok(`rep ${n}: the tech file status and photos are there`,rec?.techFile?.status==='approved'&&rec.techFile.revision===1&&rec.images?.length===2);
    ok(`rep ${n}: only the parcel keys of the spec`,rec&&Object.keys(rec.specs).every(k=>['garmentPosted','inboundReceivedAt'].includes(k))&&rec.specs.garmentPosted===true,JSON.stringify(rec?.specs));
  }

  // --- what the rep can still change, and what they cannot
  const cur=(await (await call('GET',`${B}/${id}`,rc)).json()).replication;
  const fakeAnalysis={garmentClass:'vest',measurements:[{pom:'Z',description:'rep made',xs:'',s:'',m:'',l:'',xl:'',tolerance:''}]};
  r=await call('PUT',`${B}/${id}`,rc,{...cur,images:undefined,imagePaths:[cur.imagePaths[1],cur.imagePaths[0]],aiAnalysis:fakeAnalysis,specs:{coreMaterial:'rep fabric',zippers:'rep zip',garmentPosted:true},clientTrackingCarrier:'UPS',clientTrackingNumber:'ZZ-IN-1'}); j=await r.json();
  let row=await saved(id);
  ok("the rep's save goes through",r.status===200,j.error||'');
  ok('  the AI draft is still the admin one (approved), not what the rep sent',row.ai_analysis?.measurements?.[0]?.description===SECRET_MEASURE&&row.ai_analysis?.review?.status==='approved');
  ok('  the spec details are still the admin ones',row.specs?.coreMaterial===SECRET_FABRIC&&row.specs?.zippers===SECRET_ZIP&&row.specs?.specialInstructions===SECRET_NOTE&&row.specs?.annotations?.length===1);
  ok('  the rep can still change the main photo (photo order)',row.images?.[0]===cur.imagePaths[1]);
  ok('  the rep can still log the inbound parcel',row.client_tracking_number==='ZZ-IN-1');
  ok('  and the reply still holds no tech file content',j.replication?.aiAnalysis===null&&leaks(JSON.stringify(j)).length===0);
  r=await call('PUT',`${B}/${id}`,rc,{...cur,images:undefined,imagePaths:cur.imagePaths,aiAnalysis:null,specs:{}}); row=await saved(id);
  ok('a rep save with an empty draft does not wipe the admin draft or spec',r.status===200&&row.ai_analysis?.measurements?.length===1&&row.specs?.zippers===SECRET_ZIP);
  r=await call('POST',`${B}/${id}/photos`,rc,photo(),true); j=await r.json(); pathsToClean.push(...(j.replication?.imagePaths||[]));
  ok('the rep can add a photo, and that reply holds no tech file content either',r.status===200&&j.replication?.images?.length===3&&j.replication?.aiAnalysis===null&&leaks(JSON.stringify(j)).length===0);

  // --- the scan and the tech file download
  r=await call('POST','/api/analyze-garment',rc,{replicationId:id}); j=await r.json();
  ok('the rep cannot run the AI scan on their own request',r.status===403&&/admin/i.test(j.error||''),j.error);
  r=await call('POST','/api/analyze-garment',rc,{images:['data:image/png;base64,AAAA']}); ok('nor on loose images',r.status===403);
  r=await call('POST',`${B}/${id}/downloads`,rc,{revision:1,approved:true}); ok('the rep cannot download (log) the tech file',r.status===403);
  r=await call('GET',`${B}/${id}/downloads`,rc); ok('nor read the download log',r.status===403);

  // --- straight to the database with the rep's own sign-in
  const sr=createClient(U,A,{auth:{persistSession:false}}); await sr.auth.signInWithPassword({email:repU.email,password:pw});
  const direct=await sr.from('replications').select('id,ai_analysis,specs').eq('id',id);
  ok('the rep cannot read the request (or its draft) straight from the database',!!direct.error||(direct.data||[]).length===0||(direct.data||[]).every(x=>x.ai_analysis==null),direct.error?.message||JSON.stringify(direct.data?.length));
  const dl=await sr.storage.from('replication-photos').download(cur.imagePaths[0]); ok('nor the photo files straight from storage',!!dl.error);

  // --- the admin still has everything
  r=await call('GET',`${B}/${id}`,ad); const atxt=await r.text(); j=JSON.parse(atxt);
  ok('the admin still gets the full draft and spec',j.replication?.aiAnalysis?.measurements?.[0]?.description===SECRET_MEASURE&&j.replication?.specs?.zippers===SECRET_ZIP&&leaks(atxt).length===4);
  r=await call('POST',`${B}/${id}/downloads`,ad,{revision:1,approved:true}); ok('the admin can download (log) the tech file',r.status===200);
  r=await call('POST',B,ad,{clientName:'ZZ TF Client',productName:'ZZ TF Empty',garmentType:'parka'}); j=await r.json(); ids.push(j.replication?.id);
  r=await call('POST','/api/analyze-garment',ad,{replicationId:j.replication?.id}); j=await r.json();
  ok('the admin passes the scan check (a request with no photos stops before any AI call)',r.status===400&&/no images/i.test(j.error||''),String(r.status)+' '+(j.error||''));
}catch(e){console.log('ERROR',e)}finally{
  for(const i of ids) if(i) await a.from('replications').delete().eq('id',i);
  if(pathsToClean.length) await a.storage.from('replication-photos').remove(pathsToClean);
  await a.from('notifications').delete().in('recipient_user_id',[admU.id,repU.id]);
  await a.from('notifications').delete().like('kind','replication_%').like('body','%ZZ TF%');
  await a.from('reps').delete().eq('id',rep.id);
  for(const u of [admU,repU]) await a.auth.admin.deleteUser(u.id); console.log('cleaned');
}
