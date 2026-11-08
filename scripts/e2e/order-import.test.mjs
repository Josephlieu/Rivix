// Checks the admin CSV order import: blank cells stay blank (no demo values), bad rows are skipped with a reason,
// only an admin can import, and a preview saves nothing.
// Run on DEV only, with `npm run dev` running:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/order-import.test.mjs
// Creates throwaway 'zz-' accounts and orders and removes them at the end.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x);

// --- the rules (pure)
const { checkRow, checkRows, checkHeaders, normalizeHeader, batchMatchList, batchMatchGroups } = await import('../../src/lib/order-import.ts');
const base={batch_number:'B1',customer_code:'CUST-1',product_name:'Coat',quantity:'5'};
let r=checkRow({...base},2);
ok('a minimal row is OK and every blank optional cell is null',r.ok&&r.values.material===null&&r.values.safety_standard===null&&r.values.origin===null&&r.values.order_date===null&&r.values.ship_date===null);
ok('no stage = Order Received (not In Production)',r.ok&&r.values.status==='Order Received');
ok('a valid stage from the file is used, any capitals',checkRow({...base,status:'shipped'},2).values?.status==='Shipped');
ok('an unknown stage = Order Received',checkRow({...base,status:'Teleported'},2).values?.status==='Order Received');
ok('a real YYYY-MM-DD date is kept as written',checkRow({...base,order_date:'2026-04-10'},2).values?.order_date==='2026-04-10');
for(const d of ['2026-02-30','10/04/2026','April 10 2026','2026-4-10']) ok(`bad date "${d}" rejects the row`,checkRow({...base,ship_date:d},2).ok===false);
for(const q of ['','0','-3','2.5','abc']) ok(`quantity "${q}" rejects the row (no silent 100)`,checkRow({...base,quantity:q},2).ok===false);
ok('blank customer_code rejects the row',checkRow({...base,customer_code:' '},2).ok===false);
ok('blank product_name rejects the row',checkRow({...base,product_name:''},2).ok===false);
ok('blank batch_number is allowed (the database numbers it)',checkRow({...base,batch_number:''},2).ok&&checkRow({...base,batch_number:''},2).values.batch_number==='');
let rs=checkRows([{...base},{...base,batch_number:'b1'},{...base,batch_number:''},{...base,batch_number:''}]);
ok('a repeated batch number in the file is rejected and names the first line',rs[0].ok&&!rs[1].ok&&/line 2/.test(rs[1].reason));
ok('several blank batch numbers never clash',rs[2].ok&&rs[3].ok);
ok('header names are matched ignoring capitals and spaces',normalizeHeader(' Order Date ')==='order_date');
const hd=checkHeaders(['Batch_Number','customer_code','product_name','client_name']);
ok('a missing required column is reported',hd.missing.includes('quantity'));
ok('unknown columns are listed as ignored',hd.ignored.includes('client_name'));
ok('existing-order filter: each batch number quoted, list in braces',batchMatchList(['ORD-1','B 2'])==='{"ORD-1","B 2"}');
ok('existing-order filter: _ and % are exact characters, not wildcards',batchMatchList(['A_1%'])==='{"A\\\\_1\\\\%"}',batchMatchList(['A_1%']));
ok('existing-order filter: quotes, commas and braces cannot break the list',batchMatchList(['a"b,c}'])==='{"a\\"b,c}"}',batchMatchList(['a"b,c}']));
const many=Array.from({length:1000},(_,i)=>`ORD-${String(i).padStart(4,'0')}`);
ok('a normal file is checked in one query',batchMatchGroups(many.slice(0,300)).length===1);
const groups=batchMatchGroups(many); ok('a very large file splits into a few lists, each short enough, none lost',groups.length>1&&groups.length<10&&groups.flat().length===1000&&groups.every(g=>batchMatchList(g).length<=6000),groups.length+' lists');

// --- the route (dev server + dev database)
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,x)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(x?{app_metadata:x}:{})})).data.user;
const adm=await mk(`zz-im-a-${t}@yopmail.com`,{role:'admin'}), ru=await mk(`zz-im-r-${t}@yopmail.com`,{role:'rep'}), cu=await mk(`zz-im-c-${t}@yopmail.com`), cu2=await mk(`zz-im-c2-${t}@yopmail.com`);
const {data:rep}=await a.from('reps').insert({name:'ZZ IM Rep',email:ru.email,user_id:ru.id}).select().single();
const {data:c}=await a.from('customers').insert({user_id:cu.id,company_name:'ZZ Import Co',contact_email:cu.email,customer_code:'',rep_id:rep.id}).select().single();
const {data:c2}=await a.from('customers').insert({user_id:cu2.id,company_name:'ZZ Import No Rep',contact_email:cu2.email,customer_code:''}).select().single();
const {data:old}=await a.from('orders').insert({customer_id:c.id,rep_id:rep.id,batch_number:`ZZ-OLD-${t}`,product_name:'Existing',quantity:1}).select().single();
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const x=await sb.auth.signInWithPassword({email:e,password:pw});if(x.error)throw x.error;return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(m,url,ck,body)=>fetch('http://localhost:10001'+url,{method:m,headers:{'Content-Type':'application/json',...(ck?{Cookie:ck}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
const headers=['batch_number','Customer Code','product_name','quantity','material','safety_standard','origin','order_date','ship_date','status','inspector_name'];
const code=` ${c.customer_code.toLowerCase()} `; // trimmed and any capitals still match
const row=(o)=>Object.fromEntries(headers.map(h=>[h,o[h]??'']));
const file=[
  row({batch_number:`ZZ-IM-A-${t}`,'Customer Code':code,product_name:'Blank cells coat',quantity:'7'}),                                    // line 2: OK, blanks
  row({batch_number:`ZZ-IM-B-${t}`,'Customer Code':c2.customer_code,product_name:'Full row vest',quantity:'40',material:'Mesh',safety_standard:'CSA Z96-15 Class 2',origin:'Canada',order_date:'2026-04-10',ship_date:'2026-05-02',status:'shipped',inspector_name:'Ignored'}), // line 3: OK, full
  row({batch_number:'','Customer Code':c.customer_code,product_name:'No batch parka',quantity:'3'}),                                         // line 4: OK, numbered by DB
  row({batch_number:`ZZ-IM-C-${t}`,'Customer Code':c.customer_code,product_name:'Bad date',quantity:'2',order_date:'04/10/2026'}),          // line 5: bad date
  row({batch_number:`zz-im-a-${t}`,'Customer Code':c.customer_code,product_name:'Dup in file',quantity:'1'}),                               // line 6: duplicate of line 2
  row({batch_number:old.batch_number.toLowerCase(),'Customer Code':c.customer_code,product_name:'Dup in DB',quantity:'1'}),                 // line 7: already exists (other capitals)
  row({batch_number:`ZZ-IM-D-${t}`,'Customer Code':'NOPE-999',product_name:'Unknown customer',quantity:'1'}),                               // line 8: unknown code
  row({batch_number:`ZZ-IM-E-${t}`,'Customer Code':c.customer_code,product_name:'Bad qty',quantity:'0'}),                                   // line 9: bad quantity
];
const mine=async()=>(await a.from('orders').select('*').in('customer_id',[c.id,c2.id]).neq('id',old.id)).data||[];
try{
  const ac=await cookie(adm.email), rc=await cookie(ru.email), cc=await cookie(cu.email);
  for(const [n,ck] of [['rep',rc],['customer',cc],['signed-out',null]]){
    const x=await call('POST','/api/admin/orders/import',ck,{rows:file,headers,dryRun:false}); ok(`${n} cannot import`,x.status===401||x.status>=300);
  }
  ok('  and nothing was saved by them',(await mine()).length===0);
  let x=await call('POST','/api/admin/orders/import',ac,{rows:[{batch_number:'X',product_name:'Y'}],headers:['batch_number','product_name'],dryRun:true});
  ok('a file without the required columns is refused',x.status===400&&/customer_code/.test((await x.json()).error));

  x=await call('POST','/api/admin/orders/import',ac,{rows:file,headers,dryRun:true}); let j=await x.json();
  const byLine=Object.fromEntries((j.results||[]).map(r=>[r.line,r]));
  ok('preview marks lines 2-4 OK',x.status===200&&byLine[2]?.ok&&byLine[3]?.ok&&byLine[4]?.ok,JSON.stringify(j.results?.map(r=>[r.line,r.ok,r.reason])));
  ok('preview gives the reason for each bad line',/order_date/.test(byLine[5]?.reason)&&/line 2/.test(byLine[6]?.reason)&&/already exists/.test(byLine[7]?.reason)&&/NOPE-999/.test(byLine[8]?.reason)&&/quantity/.test(byLine[9]?.reason));
  ok('preview lists ignored columns',j.ignored?.includes('inspector_name'));
  ok('a preview saves nothing',(await mine()).length===0);

  x=await call('POST','/api/admin/orders/import',ac,{rows:file,headers,dryRun:false}); j=await x.json();
  ok('import: 3 imported, 5 skipped',x.status===200&&j.imported===3&&j.skipped===5,JSON.stringify([j.imported,j.skipped,j.error]));
  const saved=await mine(); ok('exactly 3 orders were saved',saved.length===3);
  const A1=saved.find(o=>o.batch_number===`ZZ-IM-A-${t}`), B1=saved.find(o=>o.batch_number===`ZZ-IM-B-${t}`), N1=saved.find(o=>o.product_name==='No batch parka');
  ok('blank cells were saved as null, not demo values',A1&&A1.material===null&&A1.safety_standard===null&&A1.origin===null&&A1.order_date===null&&A1.ship_date===null,JSON.stringify(A1&&[A1.material,A1.safety_standard,A1.origin,A1.order_date,A1.ship_date]));
  ok('quantity and stage are as written (no 100, no forced In Production)',A1?.quantity===7&&A1?.status==='Order Received'&&B1?.status==='Shipped');
  ok('filled cells were saved as written, dates as ISO',B1&&B1.material==='Mesh'&&B1.safety_standard==='CSA Z96-15 Class 2'&&B1.origin==='Canada'&&B1.order_date==='2026-04-10'&&B1.ship_date==='2026-05-02');
  ok('customer code matched trimmed and in any capitals, and the order got the customer\'s rep',A1?.customer_id===c.id&&A1?.rep_id===rep.id);
  ok('a customer with no rep: the order has no rep (admin handles it)',B1?.customer_id===c2.id&&B1?.rep_id===null);
  ok('a blank batch number was numbered by the database',N1&&N1.batch_number&&N1.batch_number.length>0,N1?.batch_number);
  ok('the result reports the batch number the database gave',j.results.find(r=>r.line===4)?.batch_number===N1?.batch_number);
  ok('no demo text anywhere',!saved.some(o=>/Pacific Mining|ArcticShield|RIVIX QC/.test(JSON.stringify(o))));
  ok('no bad row was saved',!saved.some(o=>['Bad date','Dup in file','Dup in DB','Unknown customer','Bad qty'].includes(o.product_name)));
  const {data:items}=await a.from('order_items').select('order_id, product_name, quantity').in('order_id',saved.map(o=>o.id));
  ok('each imported order has one product line',items?.length===3&&items.every(i=>saved.some(o=>o.id===i.order_id&&o.product_name===i.product_name&&o.quantity===i.quantity)));
  const {data:notes}=await a.from('order_events').select('order_id, note, customer_visible, created_by').in('order_id',saved.map(o=>o.id)).like('note','Imported from CSV%');
  ok('each imported order has a hidden "Imported from CSV by <admin>" note',notes?.length===3&&notes.every(n=>n.customer_visible===false&&n.created_by===adm.email&&n.note===`Imported from CSV by ${adm.email}`));
  const sc=createClient(U,A,{auth:{persistSession:false}}); await sc.auth.signInWithPassword({email:cu.email,password:pw});
  const {data:seenOrders}=await sc.from('orders').select('id').in('id',saved.map(o=>o.id)); ok('the customer sees their own imported orders',seenOrders?.length===2);
  const {data:seenNotes}=await sc.from('order_events').select('note').in('order_id',saved.map(o=>o.id)); ok('the customer never sees the import note',!(seenNotes||[]).some(n=>/Imported from CSV/.test(n.note||'')));

  x=await call('POST','/api/admin/orders/import',ac,{rows:file,headers,dryRun:false}); j=await x.json();
  ok('importing the same file again adds nothing new except the blank-batch row',j.imported===1&&(await mine()).length===4,JSON.stringify([j.imported,j.skipped]));
  const pg=await fetch('http://localhost:10001/admin/import',{headers:{Cookie:ac}}); ok('admin import page loads',pg.status===200);
}catch(e){console.log('ERROR',e)}finally{
  await a.from('orders').delete().in('customer_id',[c.id,c2.id]); await a.from('customers').delete().in('id',[c.id,c2.id]); await a.from('reps').delete().eq('id',rep.id);
  for(const u of [adm,ru,cu,cu2]) await a.auth.admin.deleteUser(u.id); console.log('cleaned');
}
