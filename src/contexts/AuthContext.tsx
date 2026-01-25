import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// Auth context type definition
interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
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
  // CRITICAL: This effect runs exactly once and resolves the initial auth state
  // The loading state remains true until this completes, preventing the router
  // from rendering until auth is fully resolved (preventing black screens)
  useEffect(() => {
    let mounted = true; // Track if component is still mounted
    
    // Check for existing session (restores from localStorage on page load)
    // This runs in parallel with onAuthStateChange, but we use it as a fallback
    // to ensure loading is set to false even if onAuthStateChange hasn't fired yet
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      // Only update state if component is still mounted
      if (!mounted) return;
      
      // Update state (onAuthStateChange might have already done this, but that's OK)
      setSession(session);
      setUser(session?.user ?? null);
      
      // Check onboarding status if user exists
      if (session?.user) {
        const isComplete = await checkOnboardingStatus(session.user.id);
        if (mounted) {
          setOnboardingComplete(isComplete);
          setLoading(false); // Auth is now resolved - safe to render router
        }
      } else {
        if (mounted) {
          setOnboardingComplete(null);
          setLoading(false); // No session - still safe to render router (will show login)
        }
      }
    }).catch((error) => {
      // If getSession fails, still set loading to false so app can render
      console.error("Error getting session:", error);
      if (mounted) {
        setLoading(false);
      }
    });

    // Global auth state listener
    // This is required for invite links, magic links, and password recovery to work correctly.
    // When a user clicks an invite link (e.g., https://foodlymap.com/#access_token=...),
    // Supabase processes the hash and fires a SIGNED_IN event. We listen for this
    // event to check onboarding status and trigger redirects via AuthRedirectHandler.
    // 
    // IMPORTANT: onAuthStateChange fires immediately when registered with the current session.
    // This initial event (often INITIAL_SESSION) must also set loading to false.
    // 
    // IMPORTANT: PASSWORD_RECOVERY events must be handled explicitly.
    // When a user clicks a password reset link, Supabase authenticates them and emits
    // a PASSWORD_RECOVERY event. We must redirect to /reset-password immediately.
    // Do NOT parse window.location.hash manually - Supabase handles this internally.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session) => {
      // Only process if component is still mounted
      if (!mounted) return;
      
      // Update session and user state immediately
      setSession(session);
      setUser(session?.user ?? null);

      // Handle PASSWORD_RECOVERY event
      // This event fires when user clicks password reset link from email
      // The session is a temporary recovery session that allows password update
      // IMPORTANT: The recovery link already redirects to /reset-password via redirect_to param
      // We should NOT redirect here - it interrupts Supabase's hash processing
      // The route guard and component will handle navigation if needed
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        // Only handle PASSWORD_RECOVERY if we're actually on the reset-password page
        // This prevents stale recovery sessions from interfering with normal login
        const currentPath = window.location.pathname;
        if (currentPath === "/reset-password") {
          console.log("PASSWORD_RECOVERY event detected - session established");
          if (mounted) setLoading(false);
          return; // Don't check onboarding for recovery sessions
        } else {
          // Recovery session detected but not on reset-password page
          // This is likely a stale session - clear it
          console.warn("Stale PASSWORD_RECOVERY session detected, clearing...");
          supabase.auth.signOut().catch(() => {
            // Ignore errors - we're just cleaning up
          });
          if (mounted) {
            setSession(null);
            setUser(null);
            setOnboardingComplete(null);
            setLoading(false);
          }
          return;
        }
      }

      // Handle SIGNED_IN event (invite links, magic links, normal login)
      // This is the key event that fires when Supabase processes URL hash tokens
      if (event === "SIGNED_IN" && session?.user) {
        // Check onboarding status from profiles table
        const isComplete = await checkOnboardingStatus(session.user.id);
        if (mounted) {
          setOnboardingComplete(isComplete);
          setLoading(false);
        }
        // Navigation is handled by AuthRedirectHandler component based on onboarding status
      } else if (event === "SIGNED_OUT") {
        if (mounted) {
          setOnboardingComplete(null);
          setLoading(false);
        }
      } else if (session?.user) {
        // For other events (like TOKEN_REFRESHED, INITIAL_SESSION), update status
        const isComplete = await checkOnboardingStatus(session.user.id);
        if (mounted) {
          setOnboardingComplete(isComplete);
          setLoading(false);
        }
      } else {
        // No session (initial load with no auth, or after sign out)
        // CRITICAL: Always set loading to false, even if no session exists
        // This ensures the router renders even when user is not authenticated
        if (mounted) {
          setOnboardingComplete(null);
          setLoading(false);
        }
      }
    });

    // Safety timeout: Ensure loading is set to false after max 3 seconds
    // This prevents the app from being stuck in loading state if something goes wrong
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn("Auth initialization timeout - forcing loading to false");
        setLoading(false);
      }
    }, 3000);

    // Cleanup subscription and timeout on unmount
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
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
  // Clears session and all auth state, then signs out from Supabase
  // IMPORTANT: This must be awaited to ensure auth state change event fires
  // before navigation occurs. If navigation happens too early, the router
  // may update the URL but not re-render because auth state is still transitioning.
  const signOut = async () => {
    // Clear state immediately for instant UI feedback
    setUser(null);
    setSession(null);
    setOnboardingComplete(null);
    setLoading(true); // Set loading to prevent navigation during transition
    
    // Clear Supabase storage immediately
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
      // Ignore storage errors - not critical
      console.warn("Error clearing storage:", storageError);
    }
    
    // Sign out from Supabase and await completion
    // This ensures the SIGNED_OUT event fires and auth state stabilizes
    // before navigation occurs
    try {
      await supabase.auth.signOut();
    } catch (error: any) {
      // Log but continue - state is already cleared
      if (error?.name !== "AbortError") {
        console.warn("Supabase sign out error:", error);
      }
    } finally {
      // Set loading to false after sign out completes
      // This allows navigation to proceed once auth state is stable
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    loading,
    onboardingComplete,
    signIn,
    signOut,
    checkOnboardingStatus: checkOnboardingStatusPublic,
  };

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
