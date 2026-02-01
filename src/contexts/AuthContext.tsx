import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthState = {
  initialized: boolean;
  loading: boolean; // Alias for initialized (for clarity)
  session: Session | null;
  user: User | null;
  signInWithPassword: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    // 1) Pull existing session from storage (works on refresh)
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          if (import.meta.env.DEV) {
            console.error("Error getting session:", error);
          }
        }
        const session = data.session ?? null;
        setSession(session);
        setInitialized(true);

        // PostHog: Identify user if session exists on initial load
        // Use dynamic import to avoid initializing PostHog before PostHogProvider
        if (session?.user) {
          import("posthog-js").then(({ default: posthog }) => {
            try {
              // PostHog will handle if not initialized (no-op)
              posthog.identify(session.user.id);
              if (posthog.people) {
                posthog.people.set({ beta: true });
              }
            } catch (e) {
              // Silently ignore PostHog errors
            }
          }).catch(() => {
            // Silently ignore if PostHog is not available
          });
        }
      })
      .catch((e) => {
        if (!mounted) return;
        console.error("getSession error:", e);
        setSession(null);
        setInitialized(true);
      });

    // 2) Subscribe to auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setInitialized(true);

      // PostHog: Identify user on login, reset on logout
      // Use dynamic import to avoid initializing PostHog before PostHogProvider
      if (newSession?.user) {
        import("posthog-js").then(({ default: posthog }) => {
          try {
            // PostHog will handle if not initialized (no-op)
            posthog.identify(newSession.user.id);
            if (posthog.people) {
              posthog.people.set({ beta: true });
            }
          } catch (e) {
            // Silently ignore PostHog errors
          }
        }).catch(() => {
          // Silently ignore if PostHog is not available
        });
      } else {
        // User logged out
        import("posthog-js").then(({ default: posthog }) => {
          try {
            // PostHog will handle if not initialized (no-op)
            posthog.reset();
          } catch (e) {
            // Silently ignore PostHog errors
          }
        }).catch(() => {
          // Silently ignore if PostHog is not available
        });
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(() => {
    return {
      initialized,
      loading: !initialized, // loading is true when not initialized
      session,
      user: session?.user ?? null,
      signInWithPassword: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
      },
      signOut: async () => {
        // Clear local auth state immediately
        setSession(null);
        
        // PostHog: Reset on logout
        // Use dynamic import to avoid initializing PostHog before PostHogProvider
        import("posthog-js").then(({ default: posthog }) => {
          try {
            // PostHog will handle if not initialized (no-op)
            posthog.reset();
          } catch (e) {
            // Silently ignore PostHog errors
          }
        }).catch(() => {
          // Silently ignore if PostHog is not available
        });
        
        // Always clear Supabase localStorage keys first
        // This ensures we clean up even if remote logout fails
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (supabaseUrl) {
            // Extract project ref from URL (e.g., https://xxxxx.supabase.co -> xxxxx)
            const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)/);
            const projectRef = urlMatch?.[1];
            
            if (projectRef) {
              const keysToRemove: string[] = [];
              for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (
                  key.startsWith(`sb-${projectRef}-`) || 
                  key.startsWith("supabase.auth.token") ||
                  (key.includes("supabase") && key.includes("auth"))
                )) {
                  keysToRemove.push(key);
                }
              }
              keysToRemove.forEach(key => {
                try {
                  localStorage.removeItem(key);
                } catch (e) {
                  // Ignore individual key removal errors
                }
              });
            }
          }
        } catch (e) {
          // Ignore localStorage errors - sign out should still succeed
        }
        
        // Attempt remote logout only if we have a valid, non-expired session
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          
          // Only attempt remote logout if:
          // 1. No error getting session
          // 2. Session exists
          // 3. Access token exists
          // 4. Token is not expired (check expires_at if available)
          if (!sessionError && sessionData?.session?.access_token) {
            const session = sessionData.session;
            const isExpired = session.expires_at 
              ? session.expires_at * 1000 < Date.now() 
              : false;
            
            if (!isExpired) {
              try {
                // Use local scope - signs out current device only
                await supabase.auth.signOut({ scope: "local" });
                // Silently ignore errors - we've already cleared local state
                // Common errors: 403 (session invalid), AuthSessionMissingError
              } catch (err: any) {
                // Silently ignore expected errors (403, AuthSessionMissingError)
                // These happen when session is already invalid/expired
                // No need to log - this is expected behavior
              }
            }
          }
        } catch (getSessionError) {
          // Silently ignore - session check failed, we've already cleared local state
        }
      },
    };
  }, [initialized, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}