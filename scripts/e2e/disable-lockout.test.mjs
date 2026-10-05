// End-to-end test (dev database + running dev server). Run from the project root: node scripts/e2e/disable-lockout.test.mjs
// Creates throwaway 'zz-' accounts and removes them at the end. Needs `npm run dev` running and .env.local.
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module'; const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
import fs from 'fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).trim().replace(/^["']|["']$/g,'')]));
const U=env.NEXT_PUBLIC_SUPABASE_URL,A=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a=createClient(U,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const ok=(n,c,x='')=>console.log(c?'PASS':'FAIL',n,x);
const pw='Tmp-pass-9876!';
const u=(await a.auth.admin.createUser({email:`zz-ban-${Date.now()}@yopmail.com`,password:pw,email_confirm:true})).data.user;
const {data:c}=await a.from('customers').insert({user_id:u.id,company_name:'ZZ Ban Co',contact_email:u.email,customer_code:''}).select().single();
try{
  const j=new Map();const sb=createServerClient(U,A,{cookies:{getAll:()=>[...j].map(([name,value])=>({name,value})),setAll:l=>l.forEach(({name,value})=>j.set(name,value))}});
  const si=await sb.auth.signInWithPassword({email:u.email,password:pw});
  const ck=[...j].map(([k,v])=>`${k}=${v}`).join('; ');
  const before=await fetch('http://localhost:10001/portal',{headers:{Cookie:ck},redirect:'manual'}); ok('before disabling the portal opens (200)',before.status===200);
  await a.auth.admin.updateUserById(u.id,{ban_duration:'876000h'});
  const g=await createClient(U,A,{auth:{persistSession:false}}).auth.getUser(si.data.session.access_token); ok('after disabling, the old access token is rejected by the server',!!g.error&&/banned/i.test(g.error.message),g.error?.message||'');
  const after=await fetch('http://localhost:10001/portal',{headers:{Cookie:ck},redirect:'manual'}); ok('after disabling, the portal sends the old session to login',after.status===307&&(after.headers.get('location')||'').includes('/login'));
  const api=await fetch('http://localhost:10001/api/documents/00000000-0000-0000-0000-000000000000/file',{headers:{Cookie:ck}}); ok('after disabling, the API refuses the old cookie (401)',api.status===401,api.status);
  const rf=await createClient(U,A,{auth:{persistSession:false}}).auth.refreshSession({refresh_token:si.data.session.refresh_token}); ok('after disabling, the session cannot be refreshed',!!rf.error,rf.error?.message||'');
}finally{ await a.from('customers').delete().eq('id',c.id); await a.auth.admin.deleteUser(u.id); }
