// Checks editable account details: a customer edits only their own contact name and phone; company name, login email
// and addresses go to RIVIX as requests an admin approves or rejects; a login email change emails the OLD address.
// Run on DEV only, after audit-docs/deliverables/task-03-account-details.sql, with the server started as
//   EMAIL_DRY_RUN=1 npm run dev        (dry run: these requests email every admin and the customer)
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/account-details.test.mjs
// Creates throwaway 'zz-' accounts and removes them at the end.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
import { stepUp } from './mfa.mjs'; // task 8: admin sessions need the two-step sign-in
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x);

// --- the rules (pure)
const { checkDirectEdit, checkField, DIRECT_FIELDS, REQUEST_FIELDS } = await import('../../src/lib/account-fields.ts');
const { loginEmailChangeEmail } = await import('../../src/lib/account-emails.ts');
ok('direct fields are exactly contact name and phone',JSON.stringify(DIRECT_FIELDS)==='["contact_name","contact_phone"]');
ok('request fields are company name, login email and both addresses',JSON.stringify(REQUEST_FIELDS)==='["company_name","login_email","billing_address","shipping_address"]');
let d=checkDirectEdit({contact_name:'  Pat Lee ',contact_phone:'+1 (403) 555-0100 ext 12'}); ok('contact name and phone are accepted and trimmed',d.ok&&d.update.contact_name==='Pat Lee'&&d.update.contact_phone==='+1 (403) 555-0100 ext 12');
ok('blank clears the field',checkDirectEdit({contact_name:''}).update?.contact_name===null);
for(const k of ['company_name','contact_email','rep_id','customer_code','customer_id','id','user_id','billing_address','login_email']) ok(`direct edit refuses "${k}"`,checkDirectEdit({contact_name:'x',[k]:'y'}).ok===false);
ok('an empty body is refused',checkDirectEdit({}).ok===false);
ok('a bad phone is refused',checkField('contact_phone','call me maybe').ok===false);
ok('a bad email is refused',checkField('login_email','not-an-email').ok===false&&checkField('login_email','a@b').ok===false);
ok('company name cannot be empty',checkField('company_name','  ').ok===false);
ok('an address keeps its lines',checkField('billing_address','1 Main St \n Calgary AB ').value==='1 Main St\nCalgary AB');
let m=loginEmailChangeEmail({oldEmail:'old@example.com',newEmail:'new@example.com',company:'Sayem Co',stage:'requested'});
ok('login change email goes to the OLD address',m.to==='old@example.com');
ok('it says the new address and to contact RIVIX if it was not them',/changing to new@example\.com/.test(m.text)&&/If this wasn't you, contact RIVIX/.test(m.text)&&/If this wasn&#39;t you|If this wasn't you/.test(m.html));
m=loginEmailChangeEmail({oldEmail:'old@example.com',newEmail:'new@example.com',stage:'approved'}); ok('the approval email also goes to the OLD address',m.to==='old@example.com'&&/approved/.test(m.text)&&!/undefined|null/.test(m.text));

// --- the routes (dev server + dev database)
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,x)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(x?{app_metadata:x}:{})})).data.user;
const adm=await mk(`zz-ac-a-${t}@yopmail.com`,{role:'admin'}), r1=await mk(`zz-ac-r1-${t}@yopmail.com`,{role:'rep'}), r2=await mk(`zz-ac-r2-${t}@yopmail.com`,{role:'rep'});
const cu1=await mk(`zz-ac-c1-${t}@yopmail.com`), cu2=await mk(`zz-ac-c2-${t}@yopmail.com`), cu3=await mk(`zz-ac-c3-${t}@yopmail.com`);
const {data:rep1}=await a.from('reps').insert({name:'ZZ AC R1',email:r1.email,user_id:r1.id}).select().single();
const {data:rep2}=await a.from('reps').insert({name:'ZZ AC R2',email:r2.email,user_id:r2.id}).select().single();
const {data:c1}=await a.from('customers').insert({user_id:cu1.id,company_name:'ZZ Account One',contact_email:cu1.email,customer_code:'',rep_id:rep1.id}).select().single();
const {data:c2}=await a.from('customers').insert({user_id:cu2.id,company_name:'ZZ Account Two',contact_email:cu2.email,customer_code:'',rep_id:rep2.id}).select().single();
const {data:c3}=await a.from('customers').insert({user_id:cu3.id,company_name:'ZZ Account No Rep',contact_email:cu3.email,customer_code:''}).select().single();
const newEmail=`zz-ac-new-${t}@yopmail.com`;
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const x=await sb.auth.signInWithPassword({email:e,password:pw});if(x.error)throw x.error;await stepUp(sb);return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
const call=(mt,url,ck,body)=>fetch('http://localhost:10001'+url,{method:mt,headers:{'Content-Type':'application/json',...(ck?{Cookie:ck}:{})},body:body?JSON.stringify(body):undefined,redirect:'manual'});
const cust=async id=>(await a.from('customers').select('*').eq('id',id).single()).data;
const notifs=async(uid,kind)=>(await a.from('notifications').select('*').eq('recipient_user_id',uid).eq('kind',kind)).data||[];
const reqs=async cid=>(await a.from('account_change_requests').select('*').eq('customer_id',cid).order('created_at')).data||[];
try{
  const ac=await cookie(adm.email), rc1=await cookie(r1.email), rc2=await cookie(r2.email), cc1=await cookie(cu1.email), cc2=await cookie(cu2.email), cc3=await cookie(cu3.email);
  // who may use the customer routes
  let r=await call('GET','/api/portal/account',null); ok('signed-out cannot read an account',r.status===401);
  r=await call('GET','/api/portal/account',rc1); ok('a rep cannot use the customer account route',r.status===403);
  r=await call('GET','/api/portal/account',ac); ok('an admin cannot use the customer account route',r.status===403);
  r=await call('GET','/api/portal/account',cc1); let j=await r.json(); ok('the customer reads their own account',r.status===200&&j.profile.company_name==='ZZ Account One'&&j.profile.login_email===cu1.email);

  // direct edits
  r=await call('PATCH','/api/portal/account',cc1,{contact_name:'Pat Lee',contact_phone:'+1 403 555 0100'});
  let row=await cust(c1.id); ok('the customer edits their contact name and phone',r.status===200&&row.contact_name==='Pat Lee'&&row.contact_phone==='+1 403 555 0100');
  const before1=JSON.stringify(await cust(c1.id)), before2=JSON.stringify(await cust(c2.id));
  for(const [k,v] of [['company_name','Hacked Co'],['contact_email','evil@example.com'],['rep_id',rep2.id],['customer_code','X-1'],['customer_id',c2.id],['id',c2.id],['user_id',cu2.id],['billing_address','Somewhere']]){
    r=await call('PATCH','/api/portal/account',cc1,{contact_name:'Changed',[k]:v});
    ok(`sending "${k}" is refused and nothing is saved`,r.status===400&&JSON.stringify(await cust(c1.id))===before1);
  }
  ok("another customer's row never changed",JSON.stringify(await cust(c2.id))===before2);
  r=await call('PATCH','/api/portal/account',cc1,{contact_phone:'call me'}); ok('a bad phone is refused',r.status===400);
  r=await call('PATCH','/api/portal/account',rc1,{contact_name:'Rep'}); ok('a rep cannot use the direct edit',r.status===403);
  // straight to the database (browser update rights removed by the SQL)
  const s1=createClient(U,A,{auth:{persistSession:false}}); await s1.auth.signInWithPassword({email:cu1.email,password:pw});
  await s1.from('customers').update({company_name:'Direct Hack'}).eq('id',c1.id);
  await s1.from('customers').update({company_name:'Direct Hack'}).eq('id',c2.id);
  ok('a customer cannot change their own row straight through the database',(await cust(c1.id)).company_name==='ZZ Account One');
  ok("a customer cannot change another customer's row straight through the database",(await cust(c2.id)).company_name==='ZZ Account Two');
  const pg=await fetch('http://localhost:10001/portal/account',{headers:{Cookie:cc1}}); ok('the Account page loads',pg.status===200);

  // change requests
  r=await call('POST','/api/portal/account/change-requests',cc1,{changes:{company_name:'ZZ Account One Ltd',login_email:newEmail,billing_address:'1 Main St\nCalgary AB'}}); j=await r.json();
  ok('the customer asks for three changes',r.status===201&&j.requests?.length===3,j.error||'');
  if(j.oldAddressNotice==='sent'){ console.log('FAIL the dev server is NOT in dry run (EMAIL_DRY_RUN=1): stopping before more real emails'); throw new Error('not dry run'); }
  ok('the OLD login address is emailed about the login change (dry run)',j.oldAddressNotice==='dry_run'&&j.emailWarning===undefined,String(j.oldAddressNotice));
  let rows=await reqs(c1.id); ok('saved as pending, with the old values',rows.length===3&&rows.every(x=>x.status==='pending')&&rows.find(x=>x.field==='login_email').old_value===cu1.email);
  row=await cust(c1.id); ok('nothing changes until RIVIX approves',row.company_name==='ZZ Account One'&&row.billing_address===null);
  r=await call('GET','/api/portal/account',cc1); j=await r.json(); ok('the customer sees them as pending',j.requests.filter(x=>x.status==='pending').length===3);
  r=await call('POST','/api/portal/account/change-requests',cc1,{changes:{company_name:'Another Name'}}); ok('a second request for a pending field is refused',r.status===409);
  r=await call('POST','/api/portal/account/change-requests',cc1,{changes:{contact_name:'x'}}); ok('a field outside the request list is refused',r.status===400);
  r=await call('POST','/api/portal/account/change-requests',cc1,{changes:{rep_id:rep2.id}}); ok('asking to change the rep is refused',r.status===400);
  r=await call('POST','/api/portal/account/change-requests',cc1,{changes:{shipping_address:''}}); ok('asking for no change is refused',r.status===400);
  r=await call('POST','/api/portal/account/change-requests',rc1,{changes:{company_name:'x'}}); ok('a rep cannot send a customer request',r.status===403);
  ok('admins are told in the app, with a link to the client',(await notifs(adm.id,'account_change_request')).some(n=>n.link===`/admin/clients/${c1.id}`));
  ok("the customer's rep is told in the app",(await notifs(r1.id,'account_change_request')).some(n=>n.link===`/rep/customers/${c1.id}`));
  ok('another rep is not told',(await notifs(r2.id,'account_change_request')).length===0);
  r=await call('POST','/api/portal/account/change-requests',cc3,{changes:{shipping_address:'9 Dock Rd'}}); ok('a customer with no rep can ask too (admins handle it)',r.status===201&&(await notifs(adm.id,'account_change_request')).some(n=>n.link===`/admin/clients/${c3.id}`));
  const s2=createClient(U,A,{auth:{persistSession:false}}); await s2.auth.signInWithPassword({email:cu2.email,password:pw});
  ok("another customer cannot read these requests",((await s2.from('account_change_requests').select('id').eq('customer_id',c1.id)).data||[]).length===0);
  ok('the customer can read their own requests',((await s1.from('account_change_requests').select('id').eq('customer_id',c1.id)).data||[]).length===3);
  ok('a customer cannot create a request straight through the database',!!(await s1.from('account_change_requests').insert({customer_id:c1.id,field:'company_name',new_value:'x'})).error);

  // decisions
  const byField=f=>rows.find(x=>x.field===f);
  for(const [n,ck] of [['customer',cc1],['rep',rc1],['other customer',cc2],['signed-out',null]]){
    r=await call('PATCH',`/api/admin/account-requests/${byField('company_name').id}`,ck,{decision:'approve'}); ok(`${n} cannot decide a request`,(r.status===401||r.status>=300)&&(await cust(c1.id)).company_name==='ZZ Account One');
  }
  r=await call('PATCH',`/api/admin/account-requests/${byField('company_name').id}`,ac,{decision:'maybe'}); ok('an unknown decision is refused',r.status===400);
  r=await call('PATCH',`/api/admin/account-requests/00000000-0000-0000-0000-000000000000`,ac,{decision:'approve'}); ok('unknown request = 404',r.status===404);
  r=await call('PATCH',`/api/admin/account-requests/${byField('billing_address').id}`,ac,{decision:'reject',note:'Please send the full postal code'});
  ok('admin rejects: the old value stays',r.status===200&&(await cust(c1.id)).billing_address===null);
  rows=await reqs(c1.id); ok('  saved as rejected with the reason and who decided',byField('billing_address')&&rows.find(x=>x.field==='billing_address').status==='rejected'&&rows.find(x=>x.field==='billing_address').decision_note==='Please send the full postal code'&&rows.find(x=>x.field==='billing_address').decided_by===adm.email);
  r=await call('PATCH',`/api/admin/account-requests/${byField('company_name').id}`,ac,{decision:'approve'}); ok('admin approves the company name and it is applied',r.status===200&&(await cust(c1.id)).company_name==='ZZ Account One Ltd');
  r=await call('PATCH',`/api/admin/account-requests/${byField('company_name').id}`,ac,{decision:'reject'}); ok('a decided request cannot be decided again',r.status===409);
  r=await call('PATCH',`/api/admin/account-requests/${byField('login_email').id}`,ac,{decision:'approve'}); j=await r.json();
  const au=(await a.auth.admin.getUserById(cu1.id)).data.user;
  ok('approving the login email changes the sign-in email and contact email',r.status===200&&au.email===newEmail&&(await cust(c1.id)).contact_email===newEmail,j.error||'');
  ok('  and the OLD address is emailed again (dry run)',j.oldAddressNotice==='dry_run'&&j.emailWarning===undefined,String(j.oldAddressNotice));
  const sNew=createClient(U,A,{auth:{persistSession:false}}); ok('  the customer signs in with the new email',!(await sNew.auth.signInWithPassword({email:newEmail,password:pw})).error);
  const sOld=createClient(U,A,{auth:{persistSession:false}}); ok('  the old email no longer works',!!(await sOld.auth.signInWithPassword({email:cu1.email,password:pw})).error);
  const dn=await notifs(cu1.id,'account_change_decided'); ok('the customer is told about each decision in the app',dn.length===3&&dn.some(n=>/not approved/.test(n.title)&&n.body==='Please send the full postal code'));

  // admin sets the contact name directly; admin page data has the requests
  r=await call('PATCH',`/api/admin/customers/${c1.id}`,ac,{contact_name:'Set By Admin'}); ok('admin sets the contact name on the client form',r.status===200&&(await cust(c1.id)).contact_name==='Set By Admin');
  r=await call('GET',`/api/admin/customers/${c1.id}`,ac); j=await r.json(); ok('admin client data shows the contact name and the requests',j.customer?.contact_name==='Set By Admin'&&j.changeRequests?.length===3);
  const rp=await fetch(`http://localhost:10001/rep/customers/${c1.id}`,{headers:{Cookie:rc1}}); ok('the rep customer page shows the contact name',rp.status===200&&(await rp.text()).includes('Set By Admin'));
}catch(e){console.log('ERROR',e)}finally{
  await a.from('account_change_requests').delete().in('customer_id',[c1.id,c2.id,c3.id]);
  await a.from('customers').delete().in('id',[c1.id,c2.id,c3.id]); await a.from('reps').delete().in('id',[rep1.id,rep2.id]);
  for(const u of [adm,r1,r2,cu1,cu2,cu3]) await a.auth.admin.deleteUser(u.id); console.log('cleaned');
}
