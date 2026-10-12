// End-to-end test (dev database + running dev server). Run from the project root: node scripts/e2e/hiring.test.mjs
// Needs dev-schema-hiring.sql applied to the DEV project, `npm run dev` running, and .env.local.
// Creates throwaway 'zz-' accounts and a 'ZZ' candidate and removes them at the end.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module'; const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
import fs from 'fs';
import crypto from 'crypto';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const anon=createClient(U,A,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x); const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,m)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(m?{app_metadata:m}:{})})).data.user;
const adm=await mk(`zz-ha-${t}@yopmail.com`,{role:'admin'}), rep=await mk(`zz-hr-${t}@yopmail.com`,{role:'rep'}), cus=await mk(`zz-hc-${t}@yopmail.com`);
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const r=await sb.auth.signInWithPassword({email:e,password:pw});if(r.error)throw r.error;return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(m,url,ck,body,raw)=>fetch('http://localhost:10001'+url,{method:m,headers:{...(raw?{}:{'Content-Type':'application/json'}),...(ck?{Cookie:ck}:{})},body:raw?body:(body?JSON.stringify(body):undefined),redirect:'manual'});
const id=crypto.randomUUID(); const BASE='/api/admin/hiring/candidates';
let resumePath;
try{
  const ac=await cookie(adm.email), rc=await cookie(rep.email), cc=await cookie(cus.email);
  const pdf=()=>{const f=new FormData();f.append('resume',new Blob([Buffer.from('%PDF-1.4 fake resume '+t)],{type:'application/pdf'}),'resume.pdf');return f};

  // --- nobody but an admin gets in
  for(const [n,ck] of [['signed-out',null],['customer',cc],['rep',rc]]){
    const calls=[['GET',BASE],['PUT',`${BASE}/${id}`,{name:'ZZ'}],['DELETE',`${BASE}/${id}`],['GET',`${BASE}/${id}/resume`],['POST',`${BASE}/${id}/resume`,pdf(),true]];
    let blocked=true; for(const [m,u,b,raw] of calls){const x=await call(m,u,ck,b,raw); if(x.status!==401&&x.status!==403) blocked=false;}
    ok(`${n} is refused on every hiring route`,blocked);
  }

  // --- admin: create / read / validate
  let r=await call('PUT',`${BASE}/${id}`,ac,{name:'ZZ Test Candidate',email:'zz@example.com',role:'Sales Rep',status:'bogus',scorecard:{existingRolodex:99,albertaProximity:-3,industryKnowledge:7.46},notes:[{id:'n1',author:'RIVIX Admin',content:'first note',timestamp:new Date().toISOString()},{content:''}]}); let j=await r.json();
  ok('admin creates a candidate',r.status===200&&j.candidate?.id===id,j.error||'');
  ok('unknown status falls back to screening',j.candidate?.status==='screening');
  ok('scores are kept between 0 and 10, one decimal; unscored stays unscored',j.candidate?.scorecard?.existingRolodex===10&&j.candidate?.scorecard?.albertaProximity===0&&j.candidate?.scorecard?.industryKnowledge===7.5&&j.candidate?.scorecard?.salesMethodology===undefined);
  ok('empty notes are dropped',j.candidate?.notes?.length===1&&j.candidate.notes[0].content==='first note');
  r=await call('PUT',`${BASE}/${id}`,ac,{email:'x'}); ok('a candidate without a name is refused',r.status===400);
  r=await call('PUT',`${BASE}/bad%20id!`,ac,{name:'ZZ'}); ok('an unsafe id is refused',r.status===400);
  r=await call('GET',BASE,ac); j=await r.json(); ok('admin lists candidates',r.status===200&&j.candidates.some(c=>c.id===id&&c.name==='ZZ Test Candidate'));
  r=await call('PUT',`${BASE}/${id}`,ac,{name:'ZZ Test Candidate',status:'interviewing',notes:[],scorecard:{existingRolodex:10}}); j=await r.json(); ok('admin updates the same candidate (no duplicate)',r.status===200&&j.candidate.status==='interviewing');
  const cnt=await a.from('hiring_candidates').select('id').eq('id',id); ok('exactly one row exists',cnt.data.length===1);

  // --- the table is not reachable from the browser key
  const direct=await anon.from('hiring_candidates').select('id').eq('id',id);
  ok('public key cannot read candidates',!direct.data||direct.data.length===0);
  const w=await anon.from('hiring_candidates').insert({id:'zz-anon-'+t,name:'ZZ hacker'}); ok('public key cannot write candidates',!!w.error);

  // --- resume: only real PDFs, private storage, admin-only link
  const txt=new FormData(); txt.append('resume',new Blob(['not a pdf at all'],{type:'application/pdf'}),'fake.pdf');
  r=await call('POST',`${BASE}/${id}/resume`,ac,txt,true); ok('a file that is not a PDF is refused',r.status===400);
  r=await call('POST',`${BASE}/${id}/resume`,ac,pdf(),true); ok('admin attaches a PDF',r.status===200);
  const row=await a.from('hiring_candidates').select('resume_path').eq('id',id).single(); resumePath=row.data?.resume_path; ok('resume is stored under the candidate',resumePath?.startsWith(id+'/'));
  r=await call('GET',BASE,ac); j=await r.json(); ok('list says the candidate has a resume',j.candidates.find(c=>c.id===id)?.hasResume===true&&!JSON.stringify(j).includes(resumePath));
  r=await call('GET',`${BASE}/${id}/resume`,ac); const loc=r.headers.get('location'); ok('admin is sent to a private link',r.status>=300&&r.status<400&&!!loc);
  if(loc){const f=await fetch(loc); ok('the private link serves the PDF',f.status===200&&(await f.text()).startsWith('%PDF'));}
  const pub=await fetch(`${U}/storage/v1/object/public/hiring-resumes/${resumePath}`); ok('the resume has no public address',pub.status>=400);
  const bk=await anon.storage.from('hiring-resumes').download(resumePath); ok('public key cannot download the resume',!!bk.error);
  r=await call('GET',`${BASE}/zz-none/resume`,ac); ok('a candidate with no resume gives 404',r.status===404);

  // --- scoring settings (what candidates are scored on)
  const SET='/api/admin/hiring/settings';
  for(const [n,ck] of [['signed-out',null],['customer',cc],['rep',rc]]){
    const x1=await call('GET',SET,ck), x2=await call('PUT',SET,ck,{criteria:[{label:'A',weight:100}]});
    ok(`${n} cannot read or change the scoring settings`,[x1.status,x2.status].every(c=>c===401||c===403));
  }
  r=await call('GET',SET,ac); j=await r.json(); ok('admin reads the settings (defaults when none saved)',r.status===200&&j.criteria?.length>=1&&Math.abs(j.criteria.reduce((n,c)=>n+c.weight,0)-100)<0.01,j.error||'');
  const original=j;
  r=await call('PUT',SET,ac,{criteria:[{label:'A',weight:60},{label:'B',weight:30}]}); ok('weights that do not add up to 100 are refused',r.status===400);
  r=await call('PUT',SET,ac,{criteria:[{label:'',weight:100}]}); ok('a category without a name is refused',r.status===400);
  r=await call('PUT',SET,ac,{criteria:[]}); ok('an empty list is refused',r.status===400);
  r=await call('PUT',SET,ac,{criteria:Array.from({length:9},(_,n)=>({label:'C'+n,weight:n<8?11:12}))}); ok('more than 8 categories is refused',r.status===400);
  r=await call('PUT',SET,ac,{hiringFor:'a ZZ test role',criteria:[{id:'existingRolodex',label:'ZZ Renamed',description:'zz',weight:70},{label:'ZZ New',description:'new one',weight:30}]}); j=await r.json();
  ok('admin saves new criteria',r.status===200&&j.criteria.length===2&&j.hiringFor==='a ZZ test role',j.error||'');
  ok('a renamed category keeps its id; a new one gets its own',j.criteria?.[0]?.id==='existingRolodex'&&/^c_/.test(j.criteria?.[1]?.id||''));
  r=await call('GET',SET,ac); j=await r.json(); ok('the saved criteria are read back',j.criteria?.[0]?.label==='ZZ Renamed'&&j.hiringFor==='a ZZ test role');
  // --- shared background the AI is given (editable): limits, save, read back
  ok('the settings include the AI background and scoring guide',typeof original.companyContext==='string'&&original.companyContext.length>50&&typeof original.scoringGuide==='string'&&original.scoringGuide.length>20);
  r=await call('PUT',SET,ac,{criteria:original.criteria,hiringFor:original.hiringFor,companyContext:'x'.repeat(4001)}); ok('a background over 4,000 characters is refused',r.status===400);
  r=await call('PUT',SET,ac,{criteria:original.criteria,hiringFor:original.hiringFor,scoringGuide:'x'.repeat(2001)}); ok('a scoring guide over 2,000 characters is refused',r.status===400);
  r=await call('PUT',SET,ac,{criteria:original.criteria,hiringFor:original.hiringFor,companyContext:'ZZ test background about RIVIX. '.repeat(3),scoringGuide:'ZZ test scoring guide.'}); j=await r.json();
  ok('admin saves a background (or is told clearly the column is missing)',r.status===200&&(!j.contextNotSaved?j.companyContext.startsWith('ZZ test background'):/dev-schema-hiring/.test(j.contextNotSaved)),j.contextNotSaved||'');
  if(!j.contextNotSaved){ const g=await call('GET',SET,ac); const gj=await g.json(); ok('the saved background is read back',gj.companyContext.startsWith('ZZ test background')&&gj.scoringGuide==='ZZ test scoring guide.'); }
  r=await call('PUT',SET,ac,{criteria:original.criteria,hiringFor:original.hiringFor,companyContext:'',scoringGuide:''}); j=await r.json(); ok('an empty background falls back to the built-in draft',r.status===200&&j.companyContext.length>50&&j.scoringGuide.length>20);
  const direct2=await anon.from('hiring_settings').select('id'); ok('public key cannot read the settings table',!direct2.data||direct2.data.length===0);
  r=await call('GET',BASE,ac); j=await r.json(); ok('candidates saved earlier keep their scores after criteria change',j.candidates.find(c=>c.id===id)?.scorecard?.existingRolodex===10);
  await call('PUT',SET,ac,{hiringFor:original.hiringFor,criteria:original.criteria,companyContext:original.companyContext,scoringGuide:original.scoringGuide}); // put the settings back

  // --- delete removes the row and the file
  r=await call('DELETE',`${BASE}/${id}`,ac); ok('admin deletes the candidate',r.status===200);
  const gone=await a.from('hiring_candidates').select('id').eq('id',id); ok('row removed',gone.data.length===0);
  const f2=await a.storage.from('hiring-resumes').download(resumePath); ok('resume file removed',!!f2.error);
  r=await call('DELETE',`${BASE}/${id}`,ac); ok('deleting twice gives 404',r.status===404);
}catch(e){console.log('ERROR',e)}finally{
  await a.from('hiring_candidates').delete().eq('id',id);
  if(resumePath) await a.storage.from('hiring-resumes').remove([resumePath]);
  for(const u of [adm,rep,cus]) await a.auth.admin.deleteUser(u.id);console.log('cleaned');
}
