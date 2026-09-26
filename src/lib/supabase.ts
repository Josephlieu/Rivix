// Re-exports the single cookie-backed browser client (see supabase-browser.ts)
// so every part of the app shares one GoTrueClient instance. Two separate
// `createClient`/`createBrowserClient` calls in the same browser tab fight
// over the same auth storage key and silently corrupt each other's session —
// this file used to create its own plain client, which caused exactly that.
export { supabaseBrowser as supabase } from './supabase-browser';
