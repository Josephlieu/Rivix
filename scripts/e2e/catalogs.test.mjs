// Checks catalogs: a private bucket opened only through short signed links, for signed-in users only; only an admin
// can add, edit, replace or remove a catalog; the old public PDF address is gone.
// Run on DEV only, after audit-docs/deliverables/task-04-catalogs.sql, with `npm run dev` running:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/catalogs.test.mjs
// Creates throwaway 'zz-' accounts and a test catalog, and removes them at the end.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
import { stepUp } from './mfa.mjs'; // task 8: admin sessions need the two-step sign-in
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x);

const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const a=createClient(U,(env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_ROLE_KEY),{auth:{persistSession:false}});
const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,x)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(x?{app_metadata:x}:{})})).data.user;
const adm=await mk(`zz-ct-a-${t}@yopmail.com`,{role:'admin'}), ru=await mk(`zz-ct-r-${t}@yopmail.com`,{role:'rep'}), cu=await mk(`zz-ct-c-${t}@yopmail.com`);
const {data:rep}=await a.from('reps').insert({name:'ZZ CT Rep',email:ru.email,user_id:ru.id}).select().single();
const {data:c}=await a.from('customers').insert({user_id:cu.id,company_name:'ZZ Catalog Co',contact_email:cu.email,customer_code:'',rep_id:rep.id}).select().single();
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const x=await sb.auth.signInWithPassword({email:e,password:pw});if(x.error)throw x.error;await stepUp(sb);return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(m,url,ck,body)=>fetch('http://localhost:10001'+url,{method:m,headers:{'Content-Type':'application/json',...(ck?{Cookie:ck}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
const anon=createClient(U,A,{auth:{persistSession:false}});
const pdf1=Buffer.from('%PDF-1.4 zz catalog v1 '+t), pdf2=Buffer.from('%PDF-1.4 zz catalog v2 (replaced) '+t);
const paths=[]; let catId=null;
const upload=async(ck,buf,name)=>{
  const r=await call('POST','/api/admin/catalogs/upload-url',ck,{file_name:name,size:buf.length,mime:'application/pdf'}); const j=await r.json();
  if(r.status!==200) return {status:r.status};
  paths.push(j.path);
  const up=await anon.storage.from('catalogs').uploadToSignedUrl(j.path,j.token,buf,{contentType:'application/pdf'});
  return {status:200,path:j.path,error:up.error};
};
const exists=async p=>{const {data}=await a.storage.from('catalogs').list('',{search:p,limit:5});return !!data?.some(f=>f.name===p);};
const fetchFile=async(ck,id,dl)=>{const r=await call('GET',`/api/catalogs/${id}/file${dl?'?download=1':''}`,ck); if(r.status!==200) return {status:r.status}; const j=await r.json(); const f=await fetch(j.url); return {status:200,url:j.url,body:Buffer.from(await f.arrayBuffer()),disp:f.headers.get('content-disposition')};};
try{
  const ac=await cookie(adm.email), rc=await cookie(ru.email), cc=await cookie(cu.email);
  // the old public address is gone
  const pub=await fetch('http://localhost:10001/pdf/RIVIX-Apparel-Manufacturing-Catalog.pdf',{redirect:'manual'}); ok('the old public catalog address no longer serves the PDF',pub.status===404,pub.status);
  const {data:bucket}=await a.storage.getBucket('catalogs'); ok('the catalogs bucket is private',bucket&&bucket.public===false);

  // upload rules
  for(const [n,ck] of [['customer',cc],['rep',rc],['signed-out',null]]){
    const r=await call('POST','/api/admin/catalogs/upload-url',ck,{file_name:'x.pdf',size:10,mime:'application/pdf'}); ok(`${n} cannot get an upload link`,r.status===401||r.status>=300);
  }
  let r=await call('POST','/api/admin/catalogs/upload-url',ac,{file_name:'x.docx',size:10,mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}); ok('a non-PDF is refused',r.status===400);
  r=await call('POST','/api/admin/catalogs/upload-url',ac,{file_name:'big.pdf',size:51*1024*1024,mime:'application/pdf'}); ok('a file over 50 MB is refused',r.status===400);
  const u1=await upload(ac,pdf1,'ZZ Catalog 2026.pdf'); ok('admin uploads a PDF straight to the private bucket',u1.status===200&&!u1.error,u1.error?.message||'');
  r=await call('POST','/api/admin/catalogs',ac,{path:'../documents/someone/evil.pdf',file_name:'evil.pdf',title:'x'}); ok('a path outside the catalogs bucket is refused',r.status===400);
  r=await call('POST','/api/admin/catalogs',ac,{path:'00000000-0000-0000-0000-000000000000-never.pdf',file_name:'n.pdf',title:'x'}); ok('a file that never arrived is refused',r.status===400);
  r=await call('POST','/api/admin/catalogs',cc,{path:u1.path,file_name:'c.pdf',title:'Customer made'}); ok('a customer cannot record a catalog',r.status===401||r.status>=300);
  r=await call('POST','/api/admin/catalogs',ac,{path:u1.path,file_name:'ZZ Catalog 2026.pdf',title:'ZZ Catalog 2026',description:'Test catalog'}); let j=await r.json();
  ok('admin records the catalog',r.status===201&&j.id,j.error||''); catId=j.id;
  const {data:row}=await a.from('catalogs').select('*').eq('id',catId).single(); ok('size comes from storage, uploader is the admin',row.file_size===pdf1.length&&row.uploaded_by===adm.email&&row.file_path===u1.path);

  // who can see it
  for(const [n,ck] of [['customer',cc],['rep',rc],['admin',ac]]){
    const f=await fetchFile(ck,catId); ok(`${n} gets a signed link and the real file`,f.status===200&&f.body.equals(pdf1)&&/token=/.test(f.url));
  }
  const dl=await fetchFile(cc,catId,true); ok('download links save under the original file name',dl.status===200&&/ZZ Catalog 2026\.pdf/.test(dl.disp||''),dl.disp);
  r=await call('GET',`/api/catalogs/${catId}/file`,null); ok('signed-out gets 401',r.status===401);
  r=await call('GET',`/api/catalogs/00000000-0000-0000-0000-000000000000/file`,cc); ok('an unknown catalog = 404',r.status===404);
  const sc=createClient(U,A,{auth:{persistSession:false}}); await sc.auth.signInWithPassword({email:cu.email,password:pw});
  ok('a signed-in customer sees the catalog in the list',((await sc.from('catalogs').select('id').eq('id',catId)).data||[]).length===1);
  ok('signed-out sees no catalogs',((await anon.from('catalogs').select('id').eq('id',catId)).data||[]).length===0);
  ok('a customer cannot read the bucket directly (only through the signed link)',!!(await sc.storage.from('catalogs').download(u1.path)).error);
  ok('signed-out cannot read the bucket directly',!!(await anon.storage.from('catalogs').download(u1.path)).error);
  ok('a customer cannot upload to the bucket directly',!!(await sc.storage.from('catalogs').upload(`zz-direct-${t}.pdf`,pdf1,{contentType:'application/pdf'})).error);
  ok('a customer cannot add a catalog row from the browser',!!(await sc.from('catalogs').insert({title:'forged',file_path:'x',file_name:'x'})).error);
  await sc.from('catalogs').update({title:'Hacked'}).eq('id',catId); ok('a customer cannot rename a catalog from the browser',(await a.from('catalogs').select('title').eq('id',catId).single()).data.title==='ZZ Catalog 2026');
  await sc.from('catalogs').delete().eq('id',catId); ok('a customer cannot delete a catalog from the browser',((await a.from('catalogs').select('id').eq('id',catId)).data||[]).length===1);
  for(const [n,ck] of [['customer',cc],['rep',rc],['signed-out',null]]){
    r=await call('PATCH',`/api/admin/catalogs/${catId}`,ck,{title:'Hacked'}); ok(`${n} cannot edit a catalog`,r.status===401||r.status>=300);
    r=await call('DELETE',`/api/admin/catalogs/${catId}`,ck); ok(`${n} cannot remove a catalog`,r.status===401||r.status>=300);
  }
  for(const [p,ck] of [['/portal/catalogs',cc],['/rep/catalogs',rc],['/admin/catalogs',ac]]){ const pg=await fetch('http://localhost:10001'+p,{headers:{Cookie:ck},redirect:'manual'}); ok(`${p} loads`,pg.status===200,pg.status); }
  const red=await fetch('http://localhost:10001/admin/products',{headers:{Cookie:ac},redirect:'manual'}); ok('/admin/products no longer redirects to Catalogs (it is the product specs screen since task 7)',red.status===200&&!/\/admin\/catalogs/.test(red.headers.get('location')||''),red.status);

  // edit, replace, remove
  r=await call('PATCH',`/api/admin/catalogs/${catId}`,ac,{title:'ZZ Catalog 2026 (Spring)',description:''}); ok('admin edits the title and clears the description',r.status===200&&(await a.from('catalogs').select('title,description').eq('id',catId).single()).data.title==='ZZ Catalog 2026 (Spring)');
  r=await call('PATCH',`/api/admin/catalogs/${catId}`,ac,{title:'  '}); ok('an empty title is refused',r.status===400);
  const u2=await upload(ac,pdf2,'ZZ Catalog 2026 v2.pdf');
  r=await call('PATCH',`/api/admin/catalogs/${catId}`,ac,{path:u2.path,file_name:'ZZ Catalog 2026 v2.pdf'}); ok('admin replaces the file',r.status===200);
  const f2=await fetchFile(cc,catId); ok('  customers now get the new file',f2.status===200&&f2.body.equals(pdf2));
  ok('  the old file was removed from storage',!(await exists(u1.path)));
  r=await call('DELETE',`/api/admin/catalogs/${catId}`,ac); ok('admin removes the catalog',r.status===200);
  ok('  the record is gone',((await a.from('catalogs').select('id').eq('id',catId)).data||[]).length===0);
  ok('  the file is gone',!(await exists(u2.path)));
  r=await call('GET',`/api/catalogs/${catId}/file`,cc); ok('  and its link no longer works',r.status===404); catId=null;
}catch(e){console.log('ERROR',e)}finally{
  if(catId) await a.from('catalogs').delete().eq('id',catId);
  if(paths.length) await a.storage.from('catalogs').remove(paths);
  await a.from('customers').delete().eq('id',c.id); await a.from('reps').delete().eq('id',rep.id);
  for(const u of [adm,ru,cu]) await a.auth.admin.deleteUser(u.id); console.log('cleaned');
}
