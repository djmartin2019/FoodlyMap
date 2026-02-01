import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate, useSearch } from "@tanstack/react-router";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { 
    token_hash?: string;
    type?: string;
    code?: string;
    next?: string;
  } | undefined;
  const [status, setStatus] = useState<string>("Processing authentication...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (import.meta.env.DEV) {
        console.log("[Auth Callback] Starting auth callback handler", {
          hasTokenHash: !!search?.token_hash,
          hasCode: !!search?.code,
          type: search?.type,
          next: search?.next,
        });
      }

      // Clean up URL immediately to prevent re-triggering
      if (!cancelled) {
        // Preserve query params in history for debugging, but clean up hash
        const cleanUrl = window.location.pathname + (window.location.search || "");
        window.history.replaceState({}, document.title, cleanUrl);
      }

      let session = null;
      let sessionError = null;

      // Handle PKCE code exchange (preferred method)
      if (search?.code) {
        if (import.meta.env.DEV) {
          console.log("[Auth Callback] Exchanging PKCE code for session");
        }
        if (!cancelled) {
          setStatus("Verifying authentication code...");
        }

        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(search.code);
        
        if (exchangeError) {
          sessionError = exchangeError;
          if (import.meta.env.DEV) {
            console.error("[Auth Callback] Error exchanging code for session:", exchangeError);
          }
        } else {
          session = data.session;
          if (import.meta.env.DEV) {
            console.log("[Auth Callback] PKCE code exchange successful, session established");
          }
        }
      }
      // Handle token_hash verification (fallback for invite links)
      else if (search?.token_hash && search?.type) {
        if (import.meta.env.DEV) {
          console.log("[Auth Callback] Verifying OTP with token_hash", {
            type: search.type,
            hasTokenHash: !!search.token_hash,
          });
        }
        if (!cancelled) {
          setStatus("Verifying invitation...");
        }

        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          type: search.type as any, // 'invite', 'recovery', etc.
          token_hash: search.token_hash,
        });

        if (verifyError) {
          sessionError = verifyError;
          if (import.meta.env.DEV) {
            console.error("[Auth Callback] Error verifying OTP:", verifyError);
          }
        } else {
          session = data.session;
          if (import.meta.env.DEV) {
            console.log("[Auth Callback] OTP verification successful, session established");
          }
        }
      }
      // Fallback: try getSession (handles hash-based tokens when detectSessionInUrl is true)
      else {
        if (import.meta.env.DEV) {
          console.log("[Auth Callback] No code or token_hash, trying getSession");
        }
        if (!cancelled) {
          setStatus("Checking for existing session...");
        }

        const { data: sessionData, error: getSessionError } = await supabase.auth.getSession();
        
        if (getSessionError) {
          sessionError = getSessionError;
          if (import.meta.env.DEV) {
            console.error("[Auth Callback] Error getting session:", getSessionError);
          }
        } else {
          session = sessionData.session;
          if (import.meta.env.DEV) {
            console.log("[Auth Callback] Session found via getSession");
          }
        }
      }

      // Handle errors
      if (sessionError || !session) {
        if (import.meta.env.DEV) {
          console.error("[Auth Callback] Authentication failed:", {
            error: sessionError,
            hasSession: !!session,
          });
        }
        if (!cancelled) {
          setError(
            sessionError?.message || 
            "Authentication failed. The link may have expired or is invalid."
          );
          setStatus("Authentication failed. Redirecting to login...");
          setTimeout(() => {
            if (!cancelled) {
              navigate({ to: "/login", replace: true });
            }
          }, 3000);
        }
        return;
      }

      const user = session.user;

      if (import.meta.env.DEV) {
        console.log("[Auth Callback] Session established for user:", user.id);
      }

      // Ensure profile exists
      if (!cancelled) {
        setStatus("Setting up your profile...");
      }

      try {
        // Check if profile exists
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError && profileError.code !== "PGRST116") {
          // PGRST116 is "no rows returned" which is fine
          if (import.meta.env.DEV) {
            console.error("[Auth Callback] Error checking profile:", profileError);
          }
        }

        // Create profile if it doesn't exist
        if (!profileData) {
          if (import.meta.env.DEV) {
            console.log("[Auth Callback] Profile not found, creating minimal profile");
          }

          const { error: insertError } = await supabase
            .from("profiles")
            .insert({
              id: user.id,
              email: user.email || null,
              // Minimal profile - user can complete onboarding later
            });

          if (insertError) {
            // If insert fails due to unique constraint, profile might have been created by another request
            // This is fine - continue with navigation
            if (import.meta.env.DEV) {
              if (insertError.code === "23505") {
                console.log("[Auth Callback] Profile already exists (race condition)");
              } else {
                console.error("[Auth Callback] Error creating profile:", insertError);
              }
            }
          } else {
            if (import.meta.env.DEV) {
              console.log("[Auth Callback] Profile created successfully");
            }
          }
        } else {
          if (import.meta.env.DEV) {
            console.log("[Auth Callback] Profile already exists");
          }
        }
      } catch (err) {
        // Don't block navigation if profile creation fails
        if (import.meta.env.DEV) {
          console.error("[Auth Callback] Unexpected error ensuring profile:", err);
        }
      }

      // Determine next route
      if (!cancelled) {
        // Use next parameter if provided, otherwise determine based on type
        let nextRoute = search?.next || "/dashboard";
        
        // If next is /create-account, map to /set-password
        if (nextRoute === "/create-account") {
          nextRoute = "/set-password";
        }

        // If type is invite and no next specified, go to set-password
        if (!search?.next && search?.type === "invite") {
          nextRoute = "/set-password";
        }

        // Legacy: check hash for invite/recovery indicators
        const isInviteFlow = search?.type === "invite" || 
                           window.location.hash.includes("type=invite") ||
                           window.location.hash.includes("invite_token");
        
        const isRecoveryFlow = search?.type === "recovery" ||
                              window.location.hash.includes("type=recovery") ||
                              window.location.hash.includes("recovery_token");

        if (isInviteFlow && !search?.next) {
          nextRoute = "/set-password";
        } else if (isRecoveryFlow && !search?.next) {
          nextRoute = "/reset-password";
        }

        if (import.meta.env.DEV) {
          console.log("[Auth Callback] Navigation decision:", {
            type: search?.type,
            nextParam: search?.next,
            isInviteFlow,
            isRecoveryFlow,
            finalRoute: nextRoute,
          });
        }

        setStatus("Redirecting...");
        navigate({ to: nextRoute, replace: true });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate, search]);

  return (
    <div className="min-h-[60vh] grid place-items-center px-4">
      <div className="text-center">
        <div className="text-sm opacity-70 mb-2">{status}</div>
        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 max-w-md">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
