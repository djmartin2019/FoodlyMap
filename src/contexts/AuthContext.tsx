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
        // Profile doesn't exist yet or other error
        return false;
      }

      return data?.onboarding_complete ?? false;
    } catch (err) {
      console.error("Error checking onboarding status:", err);
      return false;
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Check onboarding status if user exists
      if (session?.user) {
        const isComplete = await checkOnboardingStatus(session.user.id);
        setOnboardingComplete(isComplete);
      } else {
        setOnboardingComplete(null);
      }
      
      setLoading(false);
    });

    // Global auth state listener
    // This is required for invite links, magic links, and password recovery to work correctly.
    // When a user clicks an invite link (e.g., https://foodlymap.com/#access_token=...),
    // Supabase processes the hash and fires a SIGNED_IN event. We listen for this
    // event to check onboarding status and trigger redirects via AuthRedirectHandler.
    // 
    // IMPORTANT: PASSWORD_RECOVERY events must be handled explicitly.
    // When a user clicks a password reset link, Supabase authenticates them and emits
    // a PASSWORD_RECOVERY event. We must redirect to /reset-password immediately.
    // Do NOT parse window.location.hash manually - Supabase handles this internally.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session) => {
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
        // Just log - don't redirect
        // The recovery link's redirect_to already sends user to /reset-password
        // Supabase is still processing the hash, so we must not interrupt
        console.log("PASSWORD_RECOVERY event detected - session established");
        setLoading(false);
        return; // Don't check onboarding for recovery sessions
      }

      // Handle SIGNED_IN event (invite links, magic links, normal login)
      // This is the key event that fires when Supabase processes URL hash tokens
      if (event === "SIGNED_IN" && session?.user) {
        // Check onboarding status from profiles table
        const isComplete = await checkOnboardingStatus(session.user.id);
        setOnboardingComplete(isComplete);
        setLoading(false);
        // Navigation is handled by AuthRedirectHandler component based on onboarding status
      } else if (event === "SIGNED_OUT") {
        setOnboardingComplete(null);
        setLoading(false);
      } else if (session?.user) {
        // For other events (like TOKEN_REFRESHED), update status but don't redirect
        const isComplete = await checkOnboardingStatus(session.user.id);
        setOnboardingComplete(isComplete);
        setLoading(false);
      } else {
        setOnboardingComplete(null);
        setLoading(false);
      }
    });

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  // Sign out function
  // Clears session and all auth state
  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      // Always clear state, even if signOut fails
      setUser(null);
      setSession(null);
      setOnboardingComplete(null);
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
