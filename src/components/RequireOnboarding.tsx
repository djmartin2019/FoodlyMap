import { useNavigate } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";

import { useAuth } from "../contexts/AuthContext";
import { log } from "../lib/log";
import { supabase } from "../lib/supabase";

export function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { initialized, user } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function checkOnboarding() {
      if (!initialized) return;

      if (!user) {
        if (mounted) {
          navigate({ to: "/login", replace: true, search: {} });
        }
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("onboarding_complete")
          .eq("id", user.id)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          log.error("Error checking onboarding status:", error);
        }

        const isComplete = !!data?.onboarding_complete;
        if (!mounted) return;

        if (!isComplete) {
          setAllowed(false);
          setChecking(false);
          navigate({ to: "/onboarding", replace: true });
          return;
        }

        setAllowed(true);
        setChecking(false);
      } catch (err) {
        log.error("Unexpected onboarding check error:", err);
        if (!mounted) return;
        setAllowed(false);
        setChecking(false);
        navigate({ to: "/onboarding", replace: true });
      }
    }

    checkOnboarding();
    return () => {
      mounted = false;
    };
  }, [initialized, user, navigate]);

  if (!initialized || checking) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-sm opacity-70">
        Loading...
      </div>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
