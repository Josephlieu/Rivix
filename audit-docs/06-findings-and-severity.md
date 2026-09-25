---
title: Findings & Severity
---

# RIVIX Portal & Website — Audit Findings Report

Scope reviewed: rivix.ca, portal.rivix.ca, Supabase backend, and the underlying Next.js codebase.
Every finding below includes proof — either a direct code quote, a live request/response captured during testing, or console output.

See also: [00-overview.md](./00-overview.md) · [01-roles-and-auth.md](./01-roles-and-auth.md) · [02-customer-portal.md](./02-customer-portal.md) · [03-admin-portal.md](./03-admin-portal.md) · [04-database-supabase.md](./04-database-supabase.md)

## 1. Role model — does not match expected design

**Expected (per team discussion):** three roles — Customer, Sales Person (assigned to customers), Admin (creates/manages sales team).

**Actual, as built:** only **two** access tiers exist: **Admin** and **Customer**. No Sales Person role exists anywhere.

**Proof:**
- Full-repo grep for "role" found no permission/role column in any table or auth check — the only "role" hits were `hiringStorage.ts:45` (`role: string`, a candidate's job title) and a Gemini chat message field, both unrelated to app permissions.
- [login/page.tsx:64-66](../new project query/rivix/src/app/login/page.tsx:64):
  ```ts
  // All email/password logins go to client portal
  // Admin access is gated separately via /admin/verify PIN
  router.push('/portal');
  ```
  This comment, written by whoever built the app, confirms only two paths exist: client portal or PIN-gated admin.
- Live evidence: navigated to `http://localhost:10001/admin/hiring` and found it's a "Sales Hiring & Credibility Board" — a recruiting tool to hire sales employees, not an app permission role. Screenshot on file.

**Action needed:** confirm with the team whether this role was ever built and removed, or was planned but never implemented.

---

## 2. Customer portal has no authentication check — HIGH SEVERITY

**Proof:**
- `middleware.ts` matcher only covers admin routes:
  ```ts
  export const config = { matcher: ['/admin/:path*'] };
  ```
- Every file under `src/app/portal/` (`page.tsx`, `layout.tsx`, `orders/page.tsx`, `orders/[id]/page.tsx`, `certificates/page.tsx`, `products/page.tsx`, `replication/page.tsx`) was checked — none call `supabase.auth.getSession()` or `getUser()`, and none redirect unauthenticated visitors.
- **Impact:** anyone who knows or guesses a portal URL can load customer pages and trigger their data fetches without ever logging in.
- **Live reproduction, confirmed during this audit:** logged out via the "Sign Out" button (redirects to `/login` as expected), then manually navigated directly to `/portal` — the dashboard loaded immediately with no redirect to login and no prompt to re-authenticate. This is the exact behavior the code above predicts, now confirmed live rather than just inferred from reading the code.

---

## 3. No tenant/customer scoping on data — CRITICAL, confirmed live (read AND write)

**Live test performed during this audit:**
1. Created a brand-new account `rivix-test@yopmail.com` via `/signup` (confirmed via Supabase response: `POST /auth/v1/signup` → `200 OK`, returned `id: e2efec25-1e1f-4409-bb25-98434bc30805`, `confirmation_sent_at` set, zero prior history).
2. Verified the email via the confirmation link.
3. Logged in with this brand-new account at `/login`.
4. **Result:** the dashboard displayed "Welcome back, Pacific Mining Co.", 2 orders (`RVX-2026-9421` ArcticShield Coverall, `RVX-2026-9422` ArcticShield Parka), "6 Compliance Certificates," and an account rep card for "Sayem R." with a real email and phone number — none of which belongs to this new test account. Screenshot on file.

**Root cause, quoted directly from the code:**

`portal/layout.tsx:22` — hardcoded org name shown to every visitor:
```tsx
<span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pacific Mining Co.</span>
```

`portal/page.tsx:19-30` — fetches ALL orders, then filters by a hardcoded name, plus hardcoded mock data appended regardless:
```tsx
const stored = await getOrders();
const mockData: OrderData[] = [
  { id: '1', batch_number: 'RVX-2026-9421', product_name: 'ArcticShield Coverall', ... },
  { id: '2', batch_number: 'RVX-2026-9422', product_name: 'ArcticShield Parka', ... },
];
// Filter stored orders to only show those for "Pacific Mining Co." (simulated client filtering)
const clientOrders = stored.filter(o => o.client_name === 'Pacific Mining Co.');
setOrders([...clientOrders, ...mockData]);
```
The comment "(simulated client filtering)" is written by the app's own author — confirming this was known placeholder logic, not an accident.

`storage.ts:19-31` — the underlying fetch has no user filter at all:
```ts
export const getOrders = async (): Promise<OrderData[]> => {
  const { data, error } = await supabase.from('orders').select('*');
  ...
}
```

**Confirmed to be the pattern across the entire portal, not a single page** — the identical `stored.filter(x => x.client_name === 'Pacific Mining Co.')` / `clientName === 'Pacific Mining Co.'` logic was found in:
- `portal/page.tsx` (dashboard)
- `portal/orders/page.tsx` (3 hardcoded mock orders)
- `portal/orders/[id]/page.tsx` — falls back to a hardcoded Pacific Mining Co. demo order for any unmatched order ID
- `portal/certificates/page.tsx`
- `portal/replication/page.tsx`

`portal/products/page.tsx` is the one exception — static catalog, no client-specific data.

**Write-side design flaw — would corrupt real data once the table exists:**

`replication/page.tsx:753-756` — every new replication request submitted by any logged-in customer would be saved with a hardcoded client name:
```ts
const newRequest: ReplicationRequest = {
  id: newId,
  clientName: 'Pacific Mining Co.',
  productName: newProductName,
  ...
```
`replication/page.tsx:816-819` also hardcodes the sender name in chat messages as `'Gary Vance'` for any customer's message.

**Correction (see 3c below for the full picture):** verified directly in `replicationStorage.ts` that `saveReplication()`/`getReplications()` attempt this write/read against a Supabase `replications` table that **does not exist** — the request silently fails and falls back to browser `localStorage` (key `rivix_uniform_replications_v2`). So today, replication tickets created during testing (e.g. test tickets named "asdf") are stored **only in that browser's local storage on that one device** — not in Supabase, not visible to admin, not shared with anyone. The hardcoded `'Pacific Mining Co.'`/`'Gary Vance'` write-corruption risk described above is real **but currently dormant**, exactly like the read-side issue — it activates the moment the `replications` table is created in Supabase.

**Impact:** Pacific Mining Co. is a real, verified client (confirmed present in the admin Client Directory with 2 active batches). The moment a real `replications` table exists, every customer account that logs in — including a competitor, or anyone with a throwaway email — would write into and see their data.

---

## 3c. Correction — the "orders" table doesn't exist; the portal is running on 100% hardcoded fallback data

Follow-up testing after finding #3 revealed the underlying tables don't actually exist in Supabase, which changes the nature (but not the underlying risk) of finding #3.

**Proof — direct REST queries against Supabase using the public anon key:**
```
GET /rest/v1/orders            → 404 "Could not find the table 'public.orders'"
GET /rest/v1/hiring_candidates → 404 "Could not find the table 'public.hiring_candidates'"
GET /rest/v1/replications      → 404 "Could not find the table 'public.replications'"
GET /rest/v1/products          → 404
GET /rest/v1/certificates      → 404
GET /rest/v1/clients           → 404
GET /rest/v1/users             → 404
GET /rest/v1/profiles          → 404
```
`storage.ts:25-28` swallows this failure silently:
```ts
if (error) {
  console.error('Error fetching orders:', error);
  return [];
}
```
`replicationStorage.ts:65-68` does the same, then falls back to `localStorage`:
```ts
if (error) {
  console.warn('Supabase error fetching replications, falling back to local storage:', error);
  throw error;
}
// ...caught above, then: reads/writes browser localStorage key 'rivix_uniform_replications_v2'
```

**Conclusion:** everything shown in the portal today (orders, certificates, the account rep card, **and every uniform replication ticket**) is currently either 100% hardcoded fallback data or persisted only to that one browser's `localStorage` — none of it reaches a real shared database. A replication ticket created while testing exists only on that machine/browser; it is invisible to admin, to any other customer login, and to the real production system. The underlying vulnerability in finding #3 (hardcoded client-name filtering, no per-user scoping) is still real and would activate the moment these tables are created and populated — this correction lowers the immediate risk today, not the design flaw itself.

**New finding — one table does exist and is a live, real exposure:**
- `rep_client_chats` (`id, client_email, sender, sender_name, message, timestamp`) is a real table with real rows, and is **readable by anyone, anonymously**, with the public anon key — no RLS restriction confirmed. This is an actual live PII exposure (client emails + chat message content), not simulated/demo data.
- **This table is not referenced anywhere in this local codebase** (confirmed via full-repo grep). This means either the deployed production app is running code we don't have local access to (e.g., a live chat feature matching the "Live Support Center" widget seen in the admin dashboard), or the local checkout is out of date relative to what's actually deployed.
- **Action needed:** ask the team for the actual deployed source (Vercel deployment source, or confirm the git branch/repo we should be looking at) — we cannot fully audit code we don't have.

## 3b. No self-service profile/account management

**Proof:** `find src/app/portal -maxdepth 1 -type d` shows only `certificates`, `orders`, `products`, `replication` — no `profile` or `settings` route exists anywhere in the codebase. A logged-in customer has no way to view their own account email/name or change their password.

---

## 4. Admin access is a single shared PIN, not per-person — MEDIUM-HIGH SEVERITY

**Proof:**

`middleware.ts:6-15`:
```ts
if (!pinCookie || pinCookie.value !== process.env.ADMIN_PIN) {
  ...
}
```

`api/admin/verify/route.ts:11-19` — the cookie's value is the plaintext PIN itself, not a token or session ID.

No admins table, no per-admin identity, no login audit trail. The sidebar's `mode="admin"` vs `mode="client"` prop ([admin/layout.tsx:11](../new project query/rivix/src/app/admin/layout.tsx:11), [portal/layout.tsx:11](../new project query/rivix/src/app/portal/layout.tsx:11)) only changes what's displayed — it enforces nothing.

---

## 5. Two unauthenticated, cost-bearing API routes — MEDIUM SEVERITY

**Proof:** `src/app/api/analyze-resume/route.ts` and `src/app/api/analyze-garment/route.ts` — grepped both files for any reference to cookies, auth, or `ADMIN_PIN`: none found. Compare to `src/app/api/hiring/send/route.ts:12-17`, which correctly checks:
```ts
function isAdminAuthorized(req: NextRequest): boolean {
  const adminPin = process.env.ADMIN_PIN;
  if (!adminPin) return false;
  const pinCookie = req.cookies.get('rivix_admin_pin');
  return Boolean(pinCookie && pinCookie.value === adminPin);
}
```
This function is never called in the two Gemini-backed routes.

---

## 6. Unauthenticated data leak on `/api/hiring/send` (GET) — LOW-MEDIUM SEVERITY

**Live proof — request made during this audit:**
```
GET https://portal.rivix.ca/api/hiring/send
→ 200 OK
{"email":true,"fromEmail":"RIVIX Hiring <info@rivix.ca>"}
```
No cookie, no auth header, no admin session — sent as a cold, anonymous request. The route's own code ([hiring/send/route.ts:53-58](../new project query/rivix/src/app/api/hiring/send/route.ts:53)) shows why:
```ts
export async function GET() {
  return NextResponse.json({
    email: emailConfigured(),
    fromEmail: process.env.HIRING_FROM_EMAIL || null,
  });
}
```
No `isAdminAuthorized()` check on `GET`, unlike `POST` on the same file.

---

## 7. Hardcoded production redirect breaks local/staging testing — LOW SEVERITY (fixed during audit)

**Proof of original bug**, `signup/page.tsx:26` (before fix):
```ts
options: { emailRedirectTo: `https://portal.rivix.ca/portal` }
```
This meant confirming a signup made on `localhost:10001` still redirected to production, making local testing impossible to complete end-to-end.

**Fix applied during this audit** (`signup/page.tsx`, `login/page.tsx`):
```ts
options: { emailRedirectTo: `${window.location.origin}/portal` }
```
Also replaced the blocking `alert()` on signup with an inline success/error message. Verified working in the local dev server after the fix (screenshot on file, no console errors).

---

## 7d. No show/hide toggle on password fields — LOW SEVERITY (UX)

**Observed:** on both `/signup` and `/login`, the password input is a plain `type="password"` field with no eye icon to reveal/hide what was typed.

**Impact:** minor usability gap — users can't verify what they typed before submitting, which increases mistyped-password support requests and failed login attempts. Standard UX pattern (show/hide toggle) is missing across the entire app, not just one form.

---

## 7e. Supabase auth emails are unstyled, plain-text-looking templates — LOW SEVERITY (branding)

**Observed:** the "Confirm your signup" email (and presumably password-reset/magic-link emails, same system) is Supabase's raw default template — plain black text, no RIVIX logo, no brand colors, sent from `noreply@mail.app.supabase.io` rather than a RIVIX-branded address.

**Impact:** doesn't match the rest of the branded experience, looks generic/unofficial, and could make customers hesitate to click the confirmation link (or mistake it for spam) since it carries no RIVIX identity. This is a Supabase dashboard configuration item (Authentication → Email Templates, plus custom SMTP for a branded sending domain) rather than an application code change.

---

## 7f. 404 page is Next.js's unstyled default — LOW SEVERITY (branding)

**Observed:** navigating to a non-existent route shows Next.js's default 404 page — plain, unbranded, no RIVIX logo or styling.

**Proof:** `find src/app -iname "not-found*" -o -iname "error*"` returns nothing — no `not-found.tsx` or `error.tsx` exists anywhere in `src/app/`, so Next.js falls back to its built-in default instead of a custom page.

**Impact:** low severity, but breaks the branded experience for any mistyped URL, dead link, or expired reference — a visitor lands on a generic framework page with no way back into the site or portal.

---

## 7b. No loading state while checking existing auth session — LOW SEVERITY (UX)

**Observed:** an already-logged-in user who navigates to `/login` briefly sees the full login form for about a second before being redirected to `/portal`.

**Proof — `login/page.tsx:18-26`:**
```ts
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      router.push('/portal');
    }
  });
  return () => subscription.unsubscribe();
}, [router]);
```
There is no `getSession()` check on mount, and no loading state gates the initial render — the `loading` state that exists (`useState(false)`, line 13) only covers the login **button** during submission, not the page's initial auth check. So the page always renders the full login form immediately, and only redirects once Supabase asynchronously resolves whether a session already exists.

**Impact:** low severity, but a visible flash-of-wrong-content bug — looks unpolished and could confuse a user into re-entering credentials during that window. **Fix:** show a loading spinner (gated on an initial `getSession()` call) instead of the login form until the session check resolves.

---

## 7c. Admin "Sign Out" doesn't actually log admin out — MEDIUM SEVERITY

**Observed during this audit:** clicking "Sign Out" from the admin panel redirects to `/login`, but navigating back to `/admin` immediately afterward lands directly on the dashboard — no PIN prompt.

**Root cause — `Sidebar.tsx:46-55`:** the same `Sidebar` component (and the same sign-out button) is shared between admin (`mode="admin"`) and customer (`mode="client"`) views:
```ts
const handleSignOut = async () => {
  await supabase.auth.signOut();
  router.push('/login');
};
```
This only clears a **Supabase Auth session** — relevant for customers. Admin access is a completely separate mechanism: a `rivix_admin_pin` cookie set by `/api/admin/verify/route.ts:24-30`, with a **7-day expiry** (`maxAge: 60 * 60 * 24 * 7`). `handleSignOut` never clears this cookie, so it remains valid in the browser for up to 7 days regardless of clicking "Sign Out."

**Impact:** an admin who clicks "Sign Out" — e.g., on a shared or public computer, believing they've logged out — is still fully able to access `/admin` for up to a week afterward, without re-entering the PIN. This compounds finding #4 (shared PIN, no revocation): there isn't even a working manual way to end an admin session early.

**Fix direction (for the later remediation phase, not applied now — audit-only per current phase):** a proper admin logout should call a route that clears the `rivix_admin_pin` cookie server-side (e.g., `response.cookies.delete('rivix_admin_pin')` or setting `maxAge: 0`), and the shared `Sidebar` sign-out handler needs to branch based on `mode` to call the right logout path for admin vs. customer.

---

## 7g. "New Replication Request" shows the wrong ticket's data — MEDIUM SEVERITY (UX/data confusion)

**Observed during this audit:** clicking "New Replication Request" opens the garment-details wizard on the left, but the right-hand detail panel continues showing a previously created ticket ("asdf" / `RIV-5940`) instead of being empty — while the user is actively filling out a form for a *different*, brand-new request.

**Root cause — a self-defeating `useEffect`, `replication/page.tsx:56-67`:**
```ts
useEffect(() => {
  const loadData = async () => {
    const stored = await getReplications();
    const filtered = stored.filter(r => r.clientName === 'Pacific Mining Co.');
    setReplications(filtered);
    if (filtered.length > 0 && !selectedRep) {
      setSelectedRep(filtered[0]);
    }
  };
  loadData();
}, [selectedRep]);
```
The "New Replication Request" button (`replication/page.tsx:290`) correctly clears the selection:
```ts
onClick={() => { setWizardStep(1); setSelectedRep(null); }}
```
But because the `useEffect` above watches `selectedRep` in its own dependency array, clearing it immediately re-triggers the effect, which sees `!selectedRep` is now true and instantly re-selects `filtered[0]` — snapping the "cleared" selection right back to the old ticket. The right-hand panel renders unconditionally based on `selectedRep`, with no check for the current wizard step, so it displays that stale ticket throughout the entire new-request flow.

**Impact:** confusing and potentially misleading — a user filling out a new replication request sees old ticket data (reference number, status stepper, correspondence feed) sitting right next to the new form, with nothing indicating it's unrelated. Could lead to a user believing their new request already exists, or losing track of which ticket they're actually working on.

---

## 7h. Replication chat is entirely simulated — no real admin/team on the other end — MEDIUM SEVERITY (functionality gap)

**Observed:** sending a message in a replication ticket's "Correspondence Feed" always gets a reply back about 1.5 seconds later.

**Proof — `replication/page.tsx:189-228`:**
```ts
const handleSendMessage = async () => {
  ...
  messages: [...selectedRep.messages, {
    sender: 'client',
    senderName: 'Gary Vance',   // hardcoded, not the actual logged-in user
    message: chatMessage,
    ...
  }]
  ...
  // Trigger mock admin reply after 1.5 seconds
  setTimeout(async () => {
    ...
    messages: [...latest.messages, {
      sender: 'admin',
      senderName: 'Sarah R. (RIVIX Production)',   // hardcoded
      message: `Hi Gary, thank you for the feedback. I have notified our production supervisor to review the specifications of the ${latest.productName}. We will adjust the material sample accordingly.`,
      ...
    }]
  }, 1500);
};
```
The code's own comment confirms it: `// Trigger mock admin reply after 1.5 seconds`. The reply is a fixed template (only the product name is substituted in) that fires automatically regardless of what the customer actually typed — no real admin, production staff, or AI reads or responds to these messages. Combined with finding 7g/3c (this feature also doesn't persist to any real database), this entire chat is a non-functional simulation end to end.

**Impact:** a customer could reasonably believe they're communicating with RIVIX's production team and wait for a response that will never come from an actual person — the canned reply gives false confidence that the request is being handled.

---

## 7i. Chat doesn't auto-scroll to the newest message — LOW-MEDIUM SEVERITY (UX)

**Observed:** pressing Enter (or clicking Send) in the replication chat appears to do nothing — no visible reaction.

**Proof:** `replication/page.tsx:974-975` — the message list container is a fixed-height, scrollable box:
```tsx
<div className="border border-slate-100 rounded-2xl bg-slate-50/50 p-6 h-[400px] overflow-y-auto space-y-4 flex flex-col justify-end">
  <div className="space-y-4 overflow-y-auto pr-2">
```
Full-file search confirms there is **no `useRef`, no `scrollIntoView()`, and no auto-scroll logic anywhere in this file.** `handleSendMessage()` (see finding 7h) does correctly append the new message to state — it just renders below the visible 400px window, with nothing scrolling the view down to reveal it.

**Impact:** the feature technically works, but appears completely broken to a user — pressing Enter looks like it silently fails, since the sent message is invisible unless the user manually scrolls the small chat box down.

---

## 7j. Admin dashboard runs entirely on fake/local data — MEDIUM SEVERITY

**Proof — `admin/page.tsx`:** every stat card is derived from the same unreliable `getOrders()` call (falls back to local storage, per finding 3c):
```ts
{ label: 'Total Clients', value: new Set(orders.map(o => o.client_name)).size.toString(), ... },
{ label: 'Active Orders', value: orders.filter(o => o.status !== 'Delivered').length.toString(), ... },
{ label: 'Certs Generated', value: (orders.length * 3).toString(), ... },
{ label: 'Revenue (MTD)', value: `$${(orders.length * 1250).toLocaleString()}`, ... },
```
"Certs Generated" and "Revenue (MTD)" aren't even real counts — they're made-up formulas (`orders.length * 3`, `orders.length * 1250`) with no connection to actual certificates or QuickBooks/revenue data. The "Order Velocity Chart" is a static placeholder, explicitly labeled `Order Velocity Chart (Placeholder)` in the JSX. The "View All" button next to Recent Activity has no `onClick` and no link — it does nothing.

**Impact:** any real admin logging in on their own computer would see mostly zeros/empty states, since the dashboard depends entirely on whatever happens to be sitting in that specific browser's local storage — not a real, shared view of business activity.

## 7k. Client Directory is hardcoded demo data, not real clients — MEDIUM SEVERITY (corrects earlier finding)

**Correction:** earlier findings referred to "Pacific Mining Co." as "a real, verified client." This is inaccurate — confirmed by reading `admin/clients/page.tsx` directly:
```ts
const demoClients = [
  { id: 'test-sol', name: 'Solomon Riby-Williams (Test)', ... },
  { id: '1', name: 'Pacific Mining Co.', email: 'ops@pacificmining.com', ... },
  { id: '2', name: 'Nexus Drilling', ... },
  { id: '3', name: 'Coastal Construction', ... },
];
```
These four clients are **hardcoded directly in the component**, not read from any database — consistent with the earlier finding that no `clients` table exists in Supabase (404, confirmed in finding 3c). The list is supplemented with any client names found in local-storage-fallback order data, but since that's also fake, nothing real is ever added in practice.

**Also non-functional on this page:**
- The search box has no `value`/`onChange` — typing does nothing
- "Add New Client" has no `onClick` — does nothing
- The "⋮" per-row menu button has no `onClick` — does nothing

**Impact of the correction:** this softens the earlier "real client data at risk" framing for finding #3 — there is currently no real client sitting in a database to expose. It does not change the underlying architectural risk: the moment a real `clients`/`orders` table is created and populated, the exact same hardcoded-filtering and no-tenant-scoping problems apply.

---

## 7l. "Your RIVIX Rep" widget shown on the admin side too — LOW-MEDIUM SEVERITY (logic error)

**Proof — `Sidebar.tsx:97`:** `<RepWidget />` is rendered unconditionally, with no check on the `mode` prop:
```tsx
const links = mode === 'admin' ? adminLinks : clientLinks;
...
<RepWidget />   {/* renders for BOTH admin and client, no mode check */}
```
So the same hardcoded "Your RIVIX Rep — Sayem R." card shown to customers also appears in the **admin** sidebar — which doesn't make sense conceptually (admin doesn't need to see a customer-facing "your assigned rep" widget). This is a leftover from the shared `Sidebar` component not fully accounting for the two different modes.

**Confirmed fix direction (2026-09-22)**: client confirmed this widget should not appear on the admin side at all. Fix: gate `<RepWidget />` in `Sidebar.tsx:97` behind `mode === 'client'`.

## 7m. No admin profile page, and the profile avatar does nothing — LOW-MEDIUM SEVERITY

**Proof — `admin/layout.tsx:19-24`:** the circle next to "RIVIX Supply Co." in the header is a plain, non-interactive element:
```tsx
<div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:flex border-l border-slate-200 pl-4">
  <span>RIVIX Supply Co.</span>
  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200" />
</div>
```
It's a `<div>`, not a `<button>` — no `onClick`, no dropdown menu, nothing happens when clicked. It visually implies a profile/account menu (standard placement and shape for one) but is entirely decorative. There is also no admin profile/settings page anywhere in the codebase — matching the same gap already documented for the customer side (finding 3b), and consistent with there being no real per-admin identity at all (finding #4).

---

## 7n. No admin-driven client account creation exists at all — MEDIUM SEVERITY (scope gap)

**Question raised (2026-09-18):** does "Add New Client" on `/admin/clients` create a real, authenticated account that admin can then share credentials/an invite for, so a client can log into the customer portal?

**Confirmed: no.** Full read of `admin/clients/page.tsx` — no modal, no form, no state management for account creation, and the button itself has no `onClick` handler (see finding 7k). There is no code anywhere that generates a login, sends an invite email, or provisions a customer account from the admin side.

**Impact:** the only way a customer account is created today is via customer self-signup at `/signup` — admin/team has **no invite or provisioning flow for anyone**, customer or staff. This is the same underlying gap as the missing Team account creation (finding #1/#4), just on the customer side too. It directly affects the intended onboarding flow (sales person gets a lead's details, client "joins" the portal) — neither an admin-driven invite nor a self-signup-then-link-to-rep flow exists yet; both would need to be built.

---

## 7o. Resume analysis ("Upload Resumes" on `/admin/hiring`) — deep review, multiple issues — MEDIUM-HIGH SEVERITY

Full code review of `analyze-resume/route.ts`, plus live testing with a real uploaded PDF, confirmed this feature is genuinely built (not a stub) but has several real gaps.

**Confirmed broken — same root cause as Finding #5b (garment analysis)**: hardcodes `model: 'gemini-2.5-flash'` (line 76), the same deprecated model already confirmed to 404 in the garment analysis route. **Live-tested 2026-09-22**: uploaded a real test resume PDF, got `Failed to analyze Jordan_Mitchell_Resume.pdf` — a generic `console.error()` with no detail shown anywhere in the app's UI, only visible via the browser's dev console. This directly demonstrates the silent-failure issue below in a real scenario, not just a hypothetical.

**Security issues:**
- No authentication check at all — same pattern as Finding #5, anyone can POST to this endpoint and consume Gemini API quota
- No file size limit — accepts any size file with no validation
- No rate limiting — combined with no auth, allows unlimited scripted abuse
- Real candidate PII (name, email, phone, resume content) is sent to a third party (Google Gemini) with no visible consent/notice mechanism, and no confirmation of data-retention terms under the current free-tier key

**Performance issues:**
- Uploads process **sequentially**, not in parallel (`admin/hiring/page.tsx` loop awaits each file's full analysis before starting the next) — uploading many resumes at once could take minutes with no per-file progress shown
- No client-side timeout — if Gemini is slow, the UI waits indefinitely

**Correctness/consistency issues:**
- Duplicate-candidate matching is fragile — matches by exact case-insensitive name or email; two different real people with the same name would be **silently merged**, overwriting one's real data with the other's; minor name-format variance would fail to catch a genuine duplicate
- No validation of the AI's returned data shape/types before it flows into the UI
- Scoring (0–10 across 5 subjective categories) has no guaranteed consistency — re-analyzing the identical resume could plausibly produce different scores each time, an inherent LLM reliability limitation worth a policy decision (human sanity-check vs. fully trusting automated scores)

**On the fix itself**: swapping the deprecated model name is fast (~15–20 minutes including testing both affected routes), but **fixing the model name alone is not guaranteed to make the feature fully work** — a replacement model could format its JSON response differently (breaking the parser in a new way), have different access/quota requirements under the current key, or behave differently with any tool use. The model swap resolves the specific blocking error; it does not address any of the security/performance/correctness issues above, which are unrelated and need their own separate fixes.

**Decision (2026-09-22): holding this fix for now** — will revisit after finishing the remaining admin tab review (Import CSV) rather than fixing mid-audit.

---

## 7p. CSV Import silently substitutes fake data for unrecognized/blank rows — HIGH SEVERITY (data integrity)

**Proof — `admin/import/page.tsx:31-45`**, every field falls back to a hardcoded value if missing or unrecognized:
```ts
client_name: row.client_name || 'Pacific Mining Co.',
product_name: row.product_name || 'ArcticShield Coverall',
safety_standard: row.safety_standard || 'CSA Z96-15 Class 3',
inspector_name: row.inspector_name || 'RIVIX QC Team',
```
No column-mapping UI exists despite the step being labeled "mapping" — it only recognizes exact field names (`batch_number`, `client_name`, `product_name`, etc.) with zero fuzzy matching or user feedback if a CSV's headers differ.

**Live-tested twice, 2026-09-22, two distinct triggers for the same underlying flaw:**
1. Uploaded a CSV with correct headers but slightly different naming (`Batch`, `Client`, `Product` instead of `batch_number`, `client_name`, `product_name`) — every row would silently import as "Pacific Mining Co." / "ArcticShield Coverall," discarding the real uploaded values, with no warning shown.
2. Uploaded a CSV confirmed to contain **exactly 3 real rows** (verified directly in a spreadsheet view) — the app's preview showed **4 rows**, with an extra phantom entry (`Auto-gen / Generic / Default`) that doesn't exist anywhere in the source file. Almost certainly a trailing blank line in the CSV being parsed as an empty row and passed through the same fallback logic, fabricating a fake order out of nothing.

**Impact:** this is a genuine data-corruption risk, not just a UX gap — a real bulk import with slightly mismatched column names, or a file with a trailing blank line (extremely common), would silently create wrong or entirely fabricated order records with no indication anything went wrong. Combined with the misleading "Cloud Synchronization Enabled" notice claiming this data gets "embedded into official certificates," bad data here could propagate into real compliance documents undetected.

**Currently masked by finding 3c**: since the `orders` table doesn't exist, every import attempt fails at the database step (`saveOrders()` throws, shown as `alert("Error importing to Supabase...")`) before this corrupted data could ever actually reach a database — but the flaw activates immediately once that table exists, and this is worth fixing before it does, not after.

---

## 8. Missing/misconfigured Supabase table — LOW SEVERITY

**Proof — live console warning captured during testing:**
```
[warn] Supabase error fetching candidates, falling back to local storage:
{code: PGRST205, details: null, hint: null, message: Could not find the table 'public.hiring_candidates' in the schema cache}
```
The app expects `public.hiring_candidates` to exist and silently falls back to browser local storage instead of surfacing this as an error — meaning hiring data may not be persisting to the real database in this environment at all.

---

## 9. Dependency vulnerabilities — MEDIUM SEVERITY

**Proof — `npm install` output captured during this audit:**
```
19 vulnerabilities (1 low, 3 moderate, 14 high, 1 critical)
```
Needs `npm audit` review to identify which are exploitable in this app's actual runtime usage vs. build-tooling-only (dev dependencies).

---

## 10. Suspicious injected instruction in project files — INFORMATIONAL

**Proof — full contents of `AGENTS.md`** (referenced by `CLAUDE.md` via `@AGENTS.md`):
```md
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure
may all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation
notices.
```
`node_modules/next` ships compiled code, not a `dist/docs/` folder — verified this path does not exist in the installed `next@16.2.4` package. This reads as a prompt-injection attempt planted to manipulate AI coding assistants working on this repo, not legitimate project documentation. Recommend finding out who added this and why, and removing it.

---

## Summary table

| # | Finding | Severity |
|---|---|---|
| 3c | `rep_client_chats` table publicly readable — real client emails/messages exposed, and this feature isn't in our local codebase at all | **Critical** |
| 3 | No tenant scoping on data — the flaw is real and confirmed in code, though today's "orders"/"certs" data happens to be 100% hardcoded fallback since those tables don't exist yet | High (design flaw, currently dormant) |
| 2 | No auth check on customer portal | High |
| 4 | Shared admin PIN, no per-user accounts | Medium-High |
| 7c | Admin "Sign Out" doesn't clear the PIN cookie — still logged in for up to 7 days after "logging out" | Medium |
| 7d | No show/hide toggle on password fields (signup + login) | Low (UX) |
| 7e | Auth emails are unstyled Supabase defaults, no RIVIX branding | Low (branding) |
| 7f | 404 page is Next.js's unstyled default, no branding | Low (branding) |
| 7g | "New Replication Request" shows a stale, unrelated ticket's data due to a self-resetting effect | Medium |
| 7h | Replication chat is entirely simulated — canned reply, no real admin/team involved | Medium |
| 7i | Chat has no auto-scroll — sent messages appear to silently fail | Low-Medium |
| 7j | Admin dashboard stats/chart/activity are fake or dead — "View All" button does nothing, no activity log page exists | Medium |
| 7k | Client Directory is hardcoded demo data (corrects earlier "real client" claim); search/add/menu buttons non-functional | Medium |
| 7l | "Your RIVIX Rep" widget incorrectly shown on the admin side too (no mode check) | Low-Medium |
| 7m | No admin profile page; the header avatar looks clickable but does nothing | Low-Medium |
| 7n | No admin-driven account creation exists for customers OR staff — only self-signup works | Medium |
| 7o | Resume analysis: same deprecated model bug (live-confirmed), no auth, no rate limits, fragile duplicate matching, silent failures, PII sent to third party | Medium-High |
| 7p | CSV Import silently substitutes fake data for mismatched columns and blank rows — live-confirmed twice | **High** |
| 7q | Notification bell is fully hardcoded, mislabeled "Real-Time"; "Clear all" doesn't clear anything | Medium |
| 3b | No self-service profile/password management | Medium |
| 5 | Unauthenticated AI API routes (cost/PII exposure) | Medium |
| 9 | Dependency vulnerabilities (1 critical, 14 high) | Medium |
| 6 | Unauthenticated info leak on hiring GET route | Low-Medium |
| 8 | Missing `hiring_candidates` table, silent fallback | Low |
| 7 | Hardcoded prod redirect (fixed during audit) | Low |
| 7b | No loading state during auth check — login page flashes before redirecting an already-logged-in user | Low (UX) |
| 1 | Sales Person role missing entirely | Scope gap |
| 10 | Suspicious injected instruction in AGENTS.md | Informational |

## Next steps
1. Confirm with the team: is the Sales Person role missing by design change, or was it never finished?
2. Get read access to Supabase RLS policies to formally confirm whether database-level protection exists independent of the broken application-level filtering (finding #3).
3. Schedule the review call to align on priorities before scoping fix work.
