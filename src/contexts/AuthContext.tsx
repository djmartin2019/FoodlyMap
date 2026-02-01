import * as Sentry from "@sentry/react";
import type { Session, User } from "@supabase/supabase-js";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { log } from "../lib/log";
import { logoutAndCleanup } from "../lib/logout";
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
            log.error("Error getting session:", error);
          }
        }
        const session = data.session ?? null;
        setSession(session);
        setInitialized(true);

        // Sentry: Set user context for error tracking
        if (session?.user) {
          Sentry.setUser({
            id: session.user.id,
            email: session.user.email,
            // Don't include sensitive data like phone numbers
          });
        } else {
          Sentry.setUser(null);
        }

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
        log.error("getSession error:", e);
        setSession(null);
        setInitialized(true);
      });

    // 2) Subscribe to auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setInitialized(true);

      // Sentry: Set user context for error tracking
      if (newSession?.user) {
        Sentry.setUser({
          id: newSession.user.id,
          email: newSession.user.email,
          // Don't include sensitive data like phone numbers
        });
      } else {
        Sentry.setUser(null);
      }

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
        
        // Sentry: Clear user context on logout
        Sentry.setUser(null);
        
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
        
        // Use comprehensive logout cleanup
        // This handles remote signOut, localStorage, sessionStorage, and caches
        // Navigation is handled by the caller (router.tsx, etc.)
        await logoutAndCleanup();
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