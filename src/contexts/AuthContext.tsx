import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// Auth status enum for explicit state management
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

// Auth context type definition
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  authStatus: AuthStatus; // Explicit auth status
  onboardingComplete: boolean | null; // null = not checked yet, true/false = checked
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  checkOnboardingStatus: () => Promise<boolean | null>;
}

// Create context with undefined default (will be set by provider)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
// Manages authentication state and provides auth methods to children
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  
  // Derive explicit auth status from user/session state
  const authStatus: AuthStatus = loading 
    ? 'loading' 
    : (session?.user ? 'authenticated' : 'unauthenticated');

  // Check onboarding status from profiles table
  const checkOnboardingStatus = async (userId: string): Promise<boolean | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", userId)
        .single();

      if (error) {
        // Check if it's a "not found" error (profile doesn't exist) vs other error
        if (error.code === "PGRST116" || error.message?.includes("No rows")) {
          // Profile doesn't exist - user needs onboarding
          return false;
        }
        // Other error - log it but return null to indicate we couldn't determine status
        console.error("Error checking onboarding status:", error);
        return null;
      }

      // Return the actual value (true/false), or false if null
      return data?.onboarding_complete ?? false;
    } catch (err) {
      console.error("Error checking onboarding status:", err);
      return null; // Return null on exception to indicate status unknown
    }
  };

  // Initialize auth state on mount
  // CRITICAL: This is data-only - never blocks rendering
  // RouterProvider is always mounted, this just provides auth state
  useEffect(() => {
    let mounted = true;
    let initialLoadComplete = false;
    
    // Safety timeout: ensure loading always resolves, even if something goes wrong
    // This prevents infinite loading states on refresh
    const safetyTimeout = setTimeout(() => {
      if (mounted && !initialLoadComplete) {
        console.warn("Auth initialization timeout - forcing loading to false");
        setLoading(false);
        initialLoadComplete = true;
      }
    }, 10000); // 10 second safety timeout
    
    // Get initial session (restores from localStorage)
    supabase.auth.getSession().then(async ({ data: { session }, error: sessionError }) => {
      if (!mounted) return;
      
      if (sessionError) {
        console.error("Error getting session:", sessionError);
        setSession(null);
        setUser(null);
        setOnboardingComplete(null);
        setLoading(false);
        initialLoadComplete = true;
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const isComplete = await checkOnboardingStatus(session.user.id);
        if (mounted) {
          setOnboardingComplete(isComplete);
          setLoading(false);
          initialLoadComplete = true;
        }
      } else {
        if (mounted) {
          setOnboardingComplete(null);
          setLoading(false);
          initialLoadComplete = true;
        }
      }
    }).catch((error) => {
      console.error("Unexpected error getting session:", error);
      if (mounted) {
        setSession(null);
        setUser(null);
        setOnboardingComplete(null);
        setLoading(false);
        initialLoadComplete = true;
      }
    });

    // Global auth state listener
    // Required for invite links, magic links, and password recovery
    // onAuthStateChange fires immediately when registered with current session
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session) => {
      if (!mounted) return;
      
      // Always update session/user state
      setSession(session);
      setUser(session?.user ?? null);
      
      // Check if initial load is still pending
      // Use a closure-safe check by reading current loading state
      // If loading is true, this is likely the initial load
      // const isInitialLoad = !initialLoadComplete; // Unused for now

      // Handle PASSWORD_RECOVERY event
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        const currentPath = window.location.pathname;
        if (currentPath === "/reset-password") {
          if (mounted && !initialLoadComplete) {
            setOnboardingComplete(null);
            setLoading(false);
            initialLoadComplete = true;
          }
          return;
        } else {
          // Stale recovery session - clear it
          console.warn("Stale PASSWORD_RECOVERY session detected, clearing...");
          supabase.auth.signOut().catch(() => {});
          if (mounted && !initialLoadComplete) {
            setSession(null);
            setUser(null);
            setOnboardingComplete(null);
            setLoading(false);
            initialLoadComplete = true;
          }
          return;
        }
      }

      // Handle SIGNED_IN event
      if (event === "SIGNED_IN" && session?.user) {
        const isComplete = await checkOnboardingStatus(session.user.id);
        if (mounted) {
          setOnboardingComplete(isComplete);
          if (!initialLoadComplete) {
            setLoading(false);
            initialLoadComplete = true;
          }
        }
      } else if (event === "SIGNED_OUT") {
        if (mounted) {
          setSession(null);
          setUser(null);
          setOnboardingComplete(null);
          setLoading(false);
        }
      } else if (session?.user) {
        // Other events (TOKEN_REFRESHED, INITIAL_SESSION, etc.)
        const isComplete = await checkOnboardingStatus(session.user.id);
        if (mounted) {
          setOnboardingComplete(isComplete);
          if (!initialLoadComplete) {
            setLoading(false);
            initialLoadComplete = true;
          }
        }
      } else {
        // No session
        if (mounted && !initialLoadComplete) {
          setOnboardingComplete(null);
          setLoading(false);
          initialLoadComplete = true;
        }
      }
    });

    // Cleanup subscription and timeout on unmount
    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Expose checkOnboardingStatus for manual checks
  const checkOnboardingStatusPublic = async (): Promise<boolean | null> => {
    if (!user) return null;
    const status = await checkOnboardingStatus(user.id);
    setOnboardingComplete(status);
    return status;
  };

  // Sign in function for closed beta users
  // Only handles email/password login (no signup)
  const signIn = async (email: string, password: string) => {
    try {
      // Clear any stale recovery sessions before signing in (non-blocking)
      // This prevents PASSWORD_RECOVERY events from interfering with normal login
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        // Clear stale session in background - don't wait for it
        supabase.auth.signOut().catch(() => {
          // Ignore errors - we're just cleaning up
        });
      }

      // Now attempt sign in
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (err: any) {
      // Handle AbortError gracefully - it's common during navigation
      if (err?.name === "AbortError") {
        return { error: new Error("Login was cancelled") };
      }
      return { error: err as Error };
    }
  };

  // Sign out function
  // Clears state and signs out from Supabase
  // SIGNED_OUT event will fire and update state via onAuthStateChange
  const signOut = async () => {
    // Clear state immediately for instant UI feedback
    setUser(null);
    setSession(null);
    setOnboardingComplete(null);
    
    // Clear Supabase storage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("sb-") || key.includes("supabase"))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (storageError) {
      console.warn("Error clearing storage:", storageError);
    }
    
    // Sign out from Supabase
    // SIGNED_OUT event will fire and update state
    try {
      await supabase.auth.signOut();
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.warn("Supabase sign out error:", error);
      }
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    authStatus,
    onboardingComplete,
    signIn,
    signOut,
    checkOnboardingStatus: checkOnboardingStatusPublic,
  };

  // CRITICAL: Always render children - never block rendering
  // Auth state is provided but does not control rendering
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Hook to use auth context
// Throws error if used outside AuthProvider
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
