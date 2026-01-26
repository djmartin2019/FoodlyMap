import React, { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "@tanstack/react-router";

export function RequireAuth({ children }: { children: React.ReactNode }) {
    const { initialized, session } = useAuth();
    const navigate = useNavigate();
    
    // Redirect to login if not authenticated (only after auth is initialized)
    useEffect(() => {
        if (initialized && !session) {
            navigate({ to: "/login", replace: true, search: {} });
        }
    }, [initialized, session, navigate]);
    
    // Don't block the whole app, just show something lightweight for protected pages
    if (!initialized) {
        return (
          <div className="min-h-[50vh] grid place-items-center text-sm opacity-70">
            Loading…
          </div>
        );
    }

    // If no session after initialization, don't render (redirect will happen)
    if (!session) {
        return null;
    }

    return <>{children}</>;
}