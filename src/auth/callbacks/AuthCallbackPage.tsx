import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "@tanstack/react-router";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // This will pick up sessions created via invite/reset links.
      // For hash-based links, getSession() will parse URL tokens when detectSessionInUrl is true.
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error("callback getSession error:", error);

      // Clean up URL so refresh doesn’t keep re-triggering weirdness
      if (!cancelled) {
        window.history.replaceState({}, document.title, "/auth/callback");
      }

      // If we got a session, send them to the right place
      if (!cancelled) {
        if (data.session) {
          navigate({ to: "/dashboard" });
        } else {
          navigate({ to: "/login" });
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-[60vh] grid place-items-center">
      <div className="text-sm opacity-70">Finishing sign-in…</div>
    </div>
  );
}
