import { createClient } from "@supabase/supabase-js";

// Supabase client configuration
// IMPORTANT: Use the "anon" or "public" key, NOT the "service_role" or "secret" key
// - Anon key: Safe for client-side use, respects Row Level Security (RLS)
// - Service role key: NEVER use in client-side code - bypasses RLS and has full access
//
// Find your keys in Supabase Dashboard → Project Settings → API
// Use: Project URL (for VITE_SUPABASE_URL) and anon/public key (for VITE_SUPABASE_ANON_KEY)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.\n" +
    "Find these in Supabase Dashboard → Project Settings → API\n" +
    "Use the 'anon' or 'public' key, NOT the 'service_role' or 'secret' key."
  );
}

// Create and export a single Supabase client instance
// This client handles authentication and can be extended for database operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // SECURITY NOTE: Sessions are stored in localStorage by default in Supabase client-side apps.
    // This is a known trade-off: localStorage is accessible to JavaScript, making it vulnerable
    // to XSS attacks if malicious scripts are injected. However, this is the standard approach
    // for client-side Supabase applications.
    //
    // Mitigations in place:
    // - CSP headers prevent unauthorized script execution
    // - Supabase tokens are short-lived and auto-refresh
    // - RLS policies enforce authorization at the database level
    //
    // For enhanced security (httpOnly cookies), you would need:
    // - A backend proxy/server to handle auth
    // - Custom session management
    // - This is typically only needed for high-security applications
    //
    // Sessions will survive page refreshes
    persistSession: true,
    autoRefreshToken: true,
    // Enable URL hash detection for invite links and magic links
    // This allows Supabase to automatically process #access_token=... from invite/magic links
    detectSessionInUrl: true,
  },
});
