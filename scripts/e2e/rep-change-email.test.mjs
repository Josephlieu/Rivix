// Checks the emails sent when a customer's sales rep changes (the texts, and that a failed email never breaks the change).
// Run: node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/rep-change-email.test.mjs
// (the dev server must be running for the second half; needs .env.local)
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import fs from 'fs';
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const { repChangeEmails } = await import('../../src/lib/rep-change-emails.ts');
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x);

// --- the texts
const rep={name:'Rock Smith',title:'Account Manager',email:'rock@example.com',phone:'403-555-0101'};
let m=repChangeEmails({company:'Sayem Co',customerEmail:'sayem@example.com',customerPhone:'403-555-0199',newRep:rep});
ok('customer email goes to the customer',m.customer.to==='sayem@example.com');
ok('customer email names the new rep and how to reach them',/Rock Smith/.test(m.customer.subject)&&/Rock Smith, Account Manager/.test(m.customer.text)&&/rock@example\.com/.test(m.customer.text)&&/403-555-0101/.test(m.customer.text));
ok('new rep email goes to the rep',m.rep?.to==='rock@example.com'&&/Sayem Co/.test(m.rep.subject));
ok('new rep email gives the customer contact',/sayem@example\.com/.test(m.rep.text)&&/403-555-0199/.test(m.rep.text));
m=repChangeEmails({company:'Sayem Co',customerEmail:'sayem@example.com',newRep:null});
ok('handing a customer to the admin: customer is told RIVIX looks after them directly, nobody else is emailed',m.rep===null&&/directly/.test(m.customer.text)&&!/Hello undefined/.test(m.customer.text));
m=repChangeEmails({company:'X',customerEmail:null,newRep:{name:'R'}});
ok('missing details never print "undefined" or "null"',!/undefined|null/.test(m.customer.text+m.rep.text));

// --- the designed (HTML) version
process.env.NEXT_PUBLIC_SITE_URL='https://portal.example.com';
const { repChangeEmails: withSite } = await import('../../src/lib/rep-change-emails.ts?site');
m=withSite({company:'Sayem Co',customerEmail:'sayem@example.com',customerPhone:'403-555-0199',newRep:rep});
ok('the customer email has an HTML version with the RIVIX logo and brand colour',/<html/.test(m.customer.html)&&/cid:rivix-logo/.test(m.customer.html)&&/#c61213/i.test(m.customer.html));
ok('the HTML shows the rep contact box with working mailto and tel links',/mailto:rock@example\.com/.test(m.customer.html)&&/tel:4035550101/.test(m.customer.html));
ok('the button links to the portal when the site address is set',/href="https:\/\/portal\.example\.com\/portal"/.test(m.customer.html)&&/href="https:\/\/portal\.example\.com\/rep\/customers"/.test(m.rep.html));
ok('a plain-text version is still there for apps that cannot show HTML',m.customer.text.length>40&&!/<[a-z]/i.test(m.customer.text));
m=withSite({company:'<script>alert(1)</script> & Co',customerEmail:null,newRep:{name:'A "quoted" <b>Rep</b>',email:'x@example.com'}});
ok('anything typed by a person is escaped (no HTML injection)',!/<script>/i.test(m.customer.html+m.rep.html)&&!/<b>Rep<\/b>/.test(m.customer.html)&&/&lt;script&gt;/.test(m.customer.html));
m=withSite({company:'Sayem Co',customerEmail:'s@example.com',newRep:{name:'New Rep',email:'new@example.com'},oldRep:{name:'Old Rep',email:'old@example.com'}});
ok('the rep who LOST the customer gets an email too, saying who has them now',m.previous?.to==='old@example.com'&&/no longer assigned/.test(m.previous.subject)&&/moved to New Rep/.test(m.previous.text)&&/<html/.test(m.previous.html));
m=withSite({company:'Sayem Co',customerEmail:'s@example.com',newRep:null,oldRep:{name:'Old Rep',email:'old@example.com'}});
ok('losing a customer to the admin: the previous rep is told admin handles them',/handled directly by admin/.test(m.previous.text));
m=withSite({company:'Sayem Co',customerEmail:'s@example.com',newRep:{name:'N',email:'n@example.com'}}); ok('no previous rep means no previous-rep email',m.previous===null);
m=repChangeEmails({company:'X',customerEmail:'x@example.com',newRep:null}); ok('handing to the admin: HTML says RIVIX looks after them, with no contact box',/directly/.test(m.customer.html)&&!/Your new sales rep/.test(m.customer.html));

// --- web addresses in a message become clickable links
const { renderEmailHtml } = await import('../../src/lib/email-template.ts');
const longUrl='https://cal.com/rivix/15min?name=Greg+Lavoie&email=greg%40example.com&notes=RIVIX+candidate%3A+Greg';
let h=renderEmailHtml({title:'Hi',paragraphs:[`Pick a time here: ${longUrl}. Thanks!`]});
ok('a web address in a message is a real link to the full address',h.includes('href="https://cal.com/rivix/15min?name=Greg+Lavoie&amp;email=greg%40example.com&amp;notes=RIVIX+candidate%3A+Greg"'));
ok('the long address is shown shortened, and the sentence full stop stays outside the link',/\.\.\.<\/a>\. Thanks!/.test(h));
h=renderEmailHtml({title:'Hi',paragraphs:['Visit https://example.com/a?b=1&c=2) now']}); ok('a closing bracket after an address is not part of the link',/href="https:\/\/example\.com\/a\?b=1&amp;c=2"/.test(h)&&/<\/a>\) now/.test(h));
h=renderEmailHtml({title:'x',paragraphs:['<a href="javascript:alert(1)">x</a> https://ok.example.com']}); ok('typed HTML is still escaped when links are made',!/<a href="javascript/.test(h)&&/&lt;a href=/.test(h)&&/href="https:\/\/ok\.example\.com"/.test(h));

// --- the change still works when email cannot be sent
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const pw='Tmp-pass-9876!',t=Date.now();
const mk=async(e,x)=>(await a.auth.admin.createUser({email:e,password:pw,email_confirm:true,...(x?{app_metadata:x}:{})})).data.user;
const adm=await mk(`zz-em-a-${t}@yopmail.com`,{role:'admin'}), r1U=await mk(`zz-em-r1-${t}@yopmail.com`,{role:'rep'}), r2U=await mk(`zz-em-r2-${t}@yopmail.com`,{role:'rep'}), cuU=await mk(`zz-em-c-${t}@yopmail.com`);
const {data:r1}=await a.from('reps').insert({name:'ZZ Old',email:r1U.email,user_id:r1U.id}).select().single();
const {data:r2}=await a.from('reps').insert({name:'ZZ New',email:r2U.email,user_id:r2U.id}).select().single();
const {data:c}=await a.from('customers').insert({user_id:cuU.id,company_name:'ZZ Mail Co',contact_email:cuU.email,customer_code:'',rep_id:r1.id}).select().single();
const cookie=async e=>{const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});const x=await sb.auth.signInWithPassword({email:e,password:pw});if(x.error)throw x.error;return [...j].map(([k,v])=>`${k}=${v}`).join('; ')};
try{
  const ac=await cookie(adm.email);
  const patch=(body)=>fetch(`http://localhost:10001/api/admin/customers/${c.id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Cookie:ac},body:JSON.stringify(body)});
  let r=await patch({rep_id:r2.id}); let j=await r.json();
  ok('changing the rep succeeds even if the email cannot be sent',r.status===200&&(await a.from('customers').select('rep_id').eq('id',c.id).single()).data.rep_id===r2.id);
  const emailsOn=!!(env.RESEND_API_KEY&&(env.NOTIFY_FROM_EMAIL||env.HIRING_FROM_EMAIL));
  ok(emailsOn?'an email problem (if any) is reported as a warning, not an error':'with email unavailable the admin is told, in plain words',j.emailWarning===undefined||/email/i.test(j.emailWarning),j.emailWarning||'(no warning: emails went out or dry run)');
  const n=await a.from('notifications').select('kind').eq('recipient_user_id',r2U.id); ok('in-app notifications are still created',n.data?.some(x=>x.kind==='customer_assigned'));
  r=await patch({rep_id:null}); j=await r.json(); ok('handing the customer to the admin works',r.status===200&&(await a.from('customers').select('rep_id').eq('id',c.id).single()).data.rep_id===null);
  const nOld=await a.from('notifications').select('title').eq('recipient_user_id',r2U.id).eq('kind','customer_unassigned'); ok('the rep who lost the customer is told they are handled by admin',nOld.data?.some(x=>/no longer assigned/.test(x.title)));
  const nCu=await a.from('notifications').select('title').eq('recipient_user_id',cuU.id).eq('kind','rep_changed'); ok('the customer is told in-app',nCu.data?.length>=2);
  r=await patch({company_name:'ZZ Mail Co 2'}); j=await r.json(); ok('editing something else sends no rep-change email warning',r.status===200&&j.emailWarning===undefined);
}catch(e){console.log('ERROR',e)}finally{
  await a.from('customers').delete().eq('id',c.id); await a.from('reps').delete().in('id',[r1.id,r2.id]);
  for(const u of [adm,r1U,r2U,cuU]) await a.auth.admin.deleteUser(u.id); console.log('cleaned');
}
