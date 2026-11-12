// Checks product specifications (admin screen, customer view, files in a private bucket) and the fabric + safety
// standard on each order product, including spec suggestions in New Order (a rep only ever receives their own
// customers' specs, filtered on the server).
// Run on DEV only, after the task 5 and task 7 SQL files (audit-docs/deliverables/), with `npm run dev` running:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/product-specs.test.mjs
// Creates throwaway 'zz-' accounts and removes them at the end.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
import { stepUp } from './mfa.mjs'; // task 8: admin sessions need the two-step sign-in
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x);

// --- the pick list (pure)
const { SAFETY_STANDARDS, normalizeStandard, replacedEditionNote, REPLACED_EDITIONS } = await import('../../src/lib/safety-standards.ts');
ok('the list has CSA Z96:22 Class 1-3',['CSA Z96:22 Class 1','CSA Z96:22 Class 2','CSA Z96:22 Class 3'].every(s=>SAFETY_STANDARDS.includes(s)));
ok('the old CSA Z96-15 edition is not in the list (it goes under Other)',!SAFETY_STANDARDS.some(s=>/Z96-15/.test(s)));
ok('ANSI Type O Class 1 and Type R Class 2/3, EN ISO 20471, NFPA 2112, arc rated, CGSB and None are there',['ANSI/ISEA 107-2020 Type O Class 1','ANSI/ISEA 107-2020 Type R Class 2','ANSI/ISEA 107-2020 Type R Class 3','EN ISO 20471 Class 3','NFPA 2112 (flame resistant)','Arc rated: ASTM F1506 (NFPA 70E / CSA Z462)','CAN/CGSB-155.20 (flash fire)','None'].every(s=>SAFETY_STANDARDS.includes(s)));
ok('a list value typed in other capitals gets the exact spelling',normalizeStandard('  csa z96:22   class 2 ')==='CSA Z96:22 Class 2');
ok('anything else is kept as typed (Other)',normalizeStandard('CSA Z96-15 Class 3')==='CSA Z96-15 Class 3');
// A replaced edition shows a note (never blocks; the text is still kept as typed, checked above and below).
for(const v of ['CSA Z96-15 Class 2','Z96-15','csa z96-15 class 3','CSA Z96 - 15','CSA Z96\u201115 Class 1']) ok(`note for a replaced edition: "${v}"`,/CSA Z96-15 has been replaced by CSA Z96:22/.test(replacedEditionNote(v)||''));
for(const v of ['CSA Z96:22 Class 2','Z96-150','CSA Z96','ANSI/ISEA 107-2015 Type R Class 3','',null,undefined]) ok(`no note for "${v}"`,replacedEditionNote(v)===null);
ok('no item in the pick list gets the note',SAFETY_STANDARDS.every(s=>replacedEditionNote(s)===null));
ok('the replaced-edition list is one constant with old and current names',Array.isArray(REPLACED_EDITIONS)&&REPLACED_EDITIONS.every(e=>e.match instanceof RegExp&&e.old&&e.current));
{ const { HIVIS_STANDARDS } = await import('../../src/lib/techFileStandards.ts'); ok('the Replication suggestion list offers no replaced edition',HIVIS_STANDARDS.every(s=>replacedEditionNote(s)===null)); }
ok('empty = no standard',normalizeStandard('')===null&&normalizeStandard(null)===null);

// --- the routes (dev server + dev database)
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const a=createClient(U,(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY),{auth:{persistSession:false}});
const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,x)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(x?{app_metadata:x}:{})})).data.user;
const adm=await mk(`zz-ps-a-${t}@yopmail.com`,{role:'admin'}), r1=await mk(`zz-ps-r1-${t}@yopmail.com`,{role:'rep'}), r2=await mk(`zz-ps-r2-${t}@yopmail.com`,{role:'rep'});
const cu1=await mk(`zz-ps-c1-${t}@yopmail.com`), cu2=await mk(`zz-ps-c2-${t}@yopmail.com`);
const {data:rep1}=await a.from('reps').insert({name:'ZZ PS R1',email:r1.email,user_id:r1.id}).select().single();
const {data:rep2}=await a.from('reps').insert({name:'ZZ PS R2',email:r2.email,user_id:r2.id}).select().single();
const {data:c1}=await a.from('customers').insert({user_id:cu1.id,company_name:'ZZ Spec One',contact_email:cu1.email,customer_code:'',rep_id:rep1.id}).select().single();
const {data:c2}=await a.from('customers').insert({user_id:cu2.id,company_name:'ZZ Spec Two',contact_email:cu2.email,customer_code:'',rep_id:rep2.id}).select().single();
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const x=await sb.auth.signInWithPassword({email:e,password:pw});if(x.error)throw x.error;await stepUp(sb);return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(mt,url,ck,body)=>fetch('http://localhost:10001'+url,{method:mt,headers:{'Content-Type':'application/json',...(ck?{Cookie:ck}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
const anon=createClient(U,A,{auth:{persistSession:false}});
const signIn=async e=>{const s=createClient(U,A,{auth:{persistSession:false}});await s.auth.signInWithPassword({email:e,password:pw});return s;};
const spec=async id=>(await a.from('product_specs').select('*').eq('id',id).maybeSingle()).data;
const inBucket=async p=>{const [f,...n]=p.split('/');const {data}=await a.storage.from('product-specs').list(f,{search:n.join('/'),limit:5});return !!data?.some(x=>x.name===n.join('/'));};
const paths=[];
const upload=async(ck,cid,buf,name,mime='application/pdf')=>{
  const r=await call('POST','/api/admin/product-specs/upload-url',ck,{customer_id:cid,file_name:name,size:buf.length,mime}); const j=await r.json();
  if(r.status!==200) return {status:r.status};
  paths.push(j.path); const up=await anon.storage.from('product-specs').uploadToSignedUrl(j.path,j.token,buf,{contentType:mime});
  return {status:200,path:j.path,error:up.error};
};
const f1=Buffer.from('%PDF-1.4 zz spec v1 '+t), f2=Buffer.from('%PDF-1.4 zz spec v2 '+t);
const SPEC1=`ZZ Parka ${t}`, SPEC2=`ZZ Other Rep Coverall ${t}`;
let orderIds=[];
try{
  const ac=await cookie(adm.email), rc1=await cookie(r1.email), rc2=await cookie(r2.email), cc1=await cookie(cu1.email), cc2=await cookie(cu2.email);
  // admin creates specs
  for(const [n,ck] of [['customer',cc1],['rep',rc1],['signed-out',null]]){
    let r=await call('POST','/api/admin/product-specs',ck,{customer_id:c1.id,product_name:'x'}); ok(`${n} cannot create a spec`,r.status===401||r.status>=300);
    r=await call('GET','/api/admin/product-specs',ck); ok(`${n} cannot list all specs`,r.status===401||r.status>=300);
  }
  const u1=await upload(ac,c1.id,f1,'parka spec.pdf'); ok('admin uploads a spec file into the customer folder',u1.status===200&&!u1.error&&u1.path.startsWith(`${c1.id}/`));
  let r=await call('POST','/api/admin/product-specs/upload-url',ac,{customer_id:c1.id,file_name:'x.exe',size:10,mime:'application/x-msdownload'}); ok('a program file is refused',r.status===400);
  r=await call('POST','/api/admin/product-specs',ac,{customer_id:c1.id,product_name:SPEC1,path:`${c2.id}/someone-else.pdf`}); ok("a file path in another customer's folder is refused",r.status===400);
  r=await call('POST','/api/admin/product-specs',ac,{customer_id:c1.id,product_name:''}); ok('a spec needs a product name',r.status===400);
  r=await call('POST','/api/admin/product-specs',ac,{customer_id:c1.id,product_name:SPEC1,fabric:'300D Oxford polyester',safety_standard:'csa z96:22 class 3',description:'Winter program',file_label:'Spec sheet',path:u1.path}); let j=await r.json();
  ok('admin creates a spec with a file',r.status===201&&j.id,j.error||''); const s1=j.id;
  let row=await spec(s1); ok('  saved with the standard in the list spelling, and the file',row.safety_standard==='CSA Z96:22 Class 3'&&row.fabric==='300D Oxford polyester'&&row.file_url===u1.path);
  r=await call('POST','/api/admin/product-specs',ac,{customer_id:c2.id,product_name:SPEC2,fabric:'FR cotton',safety_standard:'NFPA 2112 (flame resistant)'}); const s2=(await r.json()).id;
  r=await call('PATCH',`/api/admin/product-specs/${s1}`,ac,{customer_id:c2.id}); ok('a spec cannot be moved to another customer',r.status===400);
  r=await call('PATCH',`/api/admin/product-specs/${s1}`,ac,{description:'Winter program 2027',safety_standard:'CSA Z96-15 Class 3'}); ok('admin edits a spec; an older edition is kept as typed (Other)',r.status===200&&(await spec(s1)).safety_standard==='CSA Z96-15 Class 3');
  r=await call('PATCH',`/api/admin/product-specs/${s1}`,ac,{safety_standard:'CSA Z96:22 Class 3'});

  // customers see their own
  const sc1=await signIn(cu1.email), sc2=await signIn(cu2.email);
  let seen=(await sc1.from('product_specs').select('id')).data||[]; ok('a customer sees only their own specs',seen.length===1&&seen[0].id===s1);
  seen=(await sc2.from('product_specs').select('id').eq('id',s1)).data||[]; ok('another customer cannot see them',seen.length===0);
  r=await call('GET',`/api/portal/product-specs/${s1}/file`,cc1); j=await r.json(); const got=j.url?Buffer.from(await (await fetch(j.url)).arrayBuffer()):null;
  ok('the customer downloads their own spec file',r.status===200&&got?.equals(f1));
  r=await call('GET',`/api/portal/product-specs/${s1}/file`,cc2); ok("another customer cannot get the file",r.status===404);
  ok('a customer cannot read the bucket directly',!!(await sc1.storage.from('product-specs').download(u1.path)).error);
  ok('a customer cannot create a spec from the browser',!!(await sc1.from('product_specs').insert({customer_id:c1.id,product_name:'forged'})).error);
  await sc1.from('product_specs').update({product_name:'Hacked'}).eq('id',s1); ok('  or change one',(await spec(s1)).product_name===SPEC1);
  await sc1.from('product_specs').delete().eq('id',s1); ok('  or delete one',!!(await spec(s1)));
  let pg=await fetch('http://localhost:10001/portal/products',{headers:{Cookie:cc1}}); ok('the customer Product Specs page loads',pg.status===200);
  pg=await fetch('http://localhost:10001/admin/products',{headers:{Cookie:ac},redirect:'manual'}); ok('/admin/products is the specs screen again (no redirect)',pg.status===200);
  r=await call('GET','/api/admin/product-specs',ac); j=await r.json(); ok('admin lists every spec with its customer',j.specs?.some(x=>x.id===s1&&x.customers?.company_name==='ZZ Spec One')&&j.specs.some(x=>x.id===s2));
  r=await call('GET',`/api/admin/product-specs/${s1}/file`,ac); ok('admin opens the file',r.status===200);

  // replace and remove the file
  const u2=await upload(ac,c1.id,f2,'parka spec v2.pdf');
  r=await call('PATCH',`/api/admin/product-specs/${s1}`,ac,{path:u2.path}); ok('admin replaces the file',r.status===200&&(await spec(s1)).file_url===u2.path);
  ok('  the old file is deleted',!(await inBucket(u1.path)));
  r=await call('PATCH',`/api/admin/product-specs/${s1}`,ac,{remove_file:true}); ok('admin removes the file',r.status===200&&(await spec(s1)).file_url===null&&!(await inBucket(u2.path)));
  r=await call('GET',`/api/portal/product-specs/${s1}/file`,cc1); ok('  the customer no longer gets a file',r.status===404);

  // suggestions in New Order: filtered on the server
  pg=await fetch('http://localhost:10001/rep/orders/new',{headers:{Cookie:rc1}}); let html=await pg.text();
  ok("the rep's New Order page receives their customer's spec",pg.status===200&&html.includes(SPEC1));
  ok("  and NEVER another rep's customer's spec (not even hidden in the page data)",!html.includes(SPEC2));
  pg=await fetch('http://localhost:10001/rep/orders/new',{headers:{Cookie:rc2}}); html=await pg.text(); ok('  the other rep gets only theirs',html.includes(SPEC2)&&!html.includes(SPEC1));
  pg=await fetch('http://localhost:10001/admin/orders/new',{headers:{Cookie:ac}}); html=await pg.text(); ok('the admin New Order page gets every spec',html.includes(SPEC1)&&html.includes(SPEC2));

  // a request pre-fill picks up the customer's spec by product name (any capitals); needs the task 5 SQL
  r=await call('POST','/api/portal/order-requests',cc1,{kind:'quote',items:[{product_name:SPEC1.toUpperCase(),sizes:[{size:'L',qty:6}]},{product_name:'No such spec',sizes:[{size:'M',qty:1}]}]});
  j=await r.json(); const reqId=j.request?.id;
  pg=await fetch(`http://localhost:10001/rep/orders/new?request=${reqId}`,{headers:{Cookie:rc1}}); html=await pg.text();
  ok("a form pre-filled from a request fills fabric and standard from the customer's matching spec",r.status===201&&pg.status===200&&html.includes('value="300D Oxford polyester"')&&html.includes('value="CSA Z96:22 Class 3"'),j.error||'');
  ok('  a product with no matching spec stays empty',(html.match(/value="300D Oxford polyester"/g)||[]).length===1);
  await a.from('order_requests').delete().eq('id',reqId);

  // orders keep fabric + standard per product
  const items=[
    {product_name:SPEC1,sizes:[{size:'L',qty:10}],fabric:'300D Oxford polyester',safety_standard:'csa z96:22 class 2'},
    {product_name:'FR coverall',sizes:[{size:'M',qty:4}],fabric:'88/12 FR cotton',safety_standard:'CSA Z96-15 Class 3'},
    {product_name:'Plain tee',sizes:[{size:'S',qty:2}]},
  ];
  r=await call('POST','/api/rep/orders',rc1,{customer_id:c1.id,items}); j=await r.json(); ok('the rep creates an order with fabric and standard per product',r.status===201,j.error||'');
  const oid=j.order?.id; orderIds.push(oid);
  let {data:its}=await a.from('order_items').select('product_name,fabric,safety_standard,position').eq('order_id',oid).order('position');
  ok('  each product keeps its own fabric and standard',its?.[0]?.fabric==='300D Oxford polyester'&&its[0].safety_standard==='CSA Z96:22 Class 2'&&its[1].fabric==='88/12 FR cotton'&&its[1].safety_standard==='CSA Z96-15 Class 3');
  ok('  a product without them stays empty (no made-up values)',its?.[2]?.fabric===null&&its[2].safety_standard===null);
  r=await call('POST','/api/rep/orders',rc1,{customer_id:c1.id,items:[{product_name:'X',sizes:[{size:'M',qty:1}],fabric:'x'.repeat(301)}]}); ok('a fabric over 300 characters is refused',r.status===400);
  r=await call('POST','/api/rep/orders',rc1,{customer_id:c1.id,items:[{product_name:'X',sizes:[{size:'M',qty:1}],safety_standard:'x'.repeat(201)}]}); ok('a standard over 200 characters is refused',r.status===400);
  r=await call('POST','/api/admin/orders',ac,{customer_id:c2.id,items:[{product_name:SPEC2,sizes:[{size:'XL',qty:3}],fabric:'FR cotton',safety_standard:'NFPA 2112 (flame resistant)'}]}); j=await r.json(); orderIds.push(j.order?.id);
  ({data:its}=await a.from('order_items').select('fabric,safety_standard').eq('order_id',j.order?.id));
  ok('the admin order saves them too',r.status===201&&its?.[0]?.safety_standard==='NFPA 2112 (flame resistant)');
  const {data:ord}=await a.from('orders').select('batch_number').eq('id',oid).single();
  for(const [n,url,ck] of [['admin',`/admin/orders/${oid}`,ac],['rep',`/rep/orders/${oid}`,rc1],['customer',`/portal/orders/${ord.batch_number}`,cc1]]){
    const p=await fetch('http://localhost:10001'+url,{headers:{Cookie:ck}}); ok(`the ${n} order page loads`,p.status===200);
  }
  const ad=await (await call('GET',`/api/admin/orders/${oid}`,ac)).json(); ok('the admin order data has each product\'s fabric and standard',ad.items?.[1]?.fabric==='88/12 FR cotton');
  const rh=await (await fetch(`http://localhost:10001/rep/orders/${oid}`,{headers:{Cookie:rc1}})).text(); ok('the rep order page shows them',rh.includes('88/12 FR cotton')&&rh.includes('CSA Z96:22 Class 2'));
  const {data:custItems}=await sc1.from('order_items').select('fabric').eq('order_id',oid); ok('the customer can read them for their order page',custItems?.some(x=>x.fabric==='88/12 FR cotton'));

  // CSV import puts the row's spec on its product line
  const {data:cc}=await a.from('customers').select('customer_code').eq('id',c1.id).single();
  r=await call('POST','/api/admin/orders/import',ac,{dryRun:false,headers:['batch_number','customer_code','product_name','quantity','material','safety_standard'],rows:[{batch_number:`ZZ-PS-${t}`,customer_code:cc.customer_code,product_name:'Imported vest',quantity:'5',material:'Mesh',safety_standard:'csa z96:22 class 2'}]});
  j=await r.json(); const {data:imp}=await a.from('orders').select('id').eq('batch_number',`ZZ-PS-${t}`).maybeSingle(); if(imp) orderIds.push(imp.id);
  const {data:impItem}=imp?await a.from('order_items').select('fabric,safety_standard').eq('order_id',imp.id).single():{data:null};
  ok("an imported row's material and standard go on its product line",j.imported===1&&impItem?.fabric==='Mesh'&&impItem?.safety_standard==='CSA Z96:22 Class 2',JSON.stringify(impItem));

  // delete
  for(const [n,ck] of [['customer',cc1],['rep',rc1]]){ r=await call('DELETE',`/api/admin/product-specs/${s1}`,ck); ok(`${n} cannot delete a spec`,r.status===401||r.status>=300); }
  r=await call('DELETE',`/api/admin/product-specs/${s1}`,ac); ok('admin deletes a spec',r.status===200&&!(await spec(s1)));
  r=await call('DELETE',`/api/admin/product-specs/${s2}`,ac);
}catch(e){console.log('ERROR',e)}finally{
  if(paths.length) await a.storage.from('product-specs').remove(paths);
  await a.from('product_specs').delete().in('customer_id',[c1.id,c2.id]);
  await a.from('order_requests').delete().in('customer_id',[c1.id,c2.id]);
  await a.from('orders').delete().in('customer_id',[c1.id,c2.id]);
  await a.from('customers').delete().in('id',[c1.id,c2.id]); await a.from('reps').delete().in('id',[rep1.id,rep2.id]);
  for(const u of [adm,r1,r2,cu1,cu2]) await a.auth.admin.deleteUser(u.id); console.log('cleaned');
}
