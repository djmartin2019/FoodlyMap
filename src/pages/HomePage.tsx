import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "../lib/supabase";
import { log } from "../lib/log";

interface Profile {
  id: string;
  email: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  onboarding_complete: boolean;
  created_at: string;
}

export default function DashboardPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }

    // Fetch user profile
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) {
          log.error("Error fetching profile:", error);
        } else {
          setProfile(data);
        }
      } catch (err) {
        log.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user, navigate]);

  const handleSignOut = async () => {
    // signOut now handles all errors internally and never throws
    // It will clear local state, storage, and caches via logoutAndCleanup
    await signOut();
    // Use hard redirect to ensure all state is cleared
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center px-6 py-12">
        <div className="text-text/60">Loading...</div>
      </div>
    );
  }

  // Route guard handles authentication - if we reach here, user should exist
  // Show loading state if user is not yet available (shouldn't happen due to auth bootstrap)
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
      </div>
    );
  }

  const displayName = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.username
    : user.email || "User";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-12 md:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-accent md:text-5xl">
            Dashboard
          </h1>
          <p className="text-text/70">
            Welcome back, <span className="font-medium text-text">{displayName}</span>
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-lg border border-surface/60 bg-surface/30 px-4 py-2 text-sm font-medium text-text transition-colors hover:border-accent/60 hover:bg-surface/50"
        >
          Sign Out
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Info Card */}
        <div className="rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm">
          <h2 className="mb-4 text-xl font-semibold text-accent">Account Information</h2>
          <div className="space-y-3">
            {profile?.first_name && (
              <div>
                <div className="text-sm text-text/60">First Name</div>
                <div className="text-text">{profile.first_name}</div>
              </div>
            )}
            {profile?.last_name && (
              <div>
                <div className="text-sm text-text/60">Last Name</div>
                <div className="text-text">{profile.last_name}</div>
              </div>
            )}
            {profile?.username && (
              <div>
                <div className="text-sm text-text/60">Username</div>
                <div className="text-text">@{profile.username}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-text/60">Email</div>
              <div className="text-text">{user.email}</div>
            </div>
            {profile?.phone && (
              <div>
                <div className="text-sm text-text/60">Phone</div>
                <div className="text-text">{profile.phone}</div>
              </div>
            )}
          </div>
        </div>

        {/* Account Status Card */}
        <div className="rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm">
          <h2 className="mb-4 text-xl font-semibold text-accent">Account Status</h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-text/60">Account Status</div>
              <div className="text-text">
                {profile?.onboarding_complete ? (
                  <span className="text-accent">✓ Onboarding Complete</span>
                ) : (
                  <span className="text-yellow-400">Pending Onboarding</span>
                )}
              </div>
            </div>
            {profile?.created_at && (
              <div>
                <div className="text-sm text-text/60">Member Since</div>
                <div className="text-text">
                  {new Date(profile.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
            )}
            <div>
              <div className="text-sm text-text/60">User ID</div>
              <div className="font-mono text-xs text-text/60">{user.id}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Placeholder for future features */}
      <div className="mt-6 rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm">
        <p className="text-text/80">
          More features coming soon. This is your dashboard where you'll be able to manage your
          account and access Foodly Map features.
        </p>
      </div>
    </div>
  );
}
