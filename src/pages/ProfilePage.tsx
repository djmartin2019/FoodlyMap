import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface Profile {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  created_at: string;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (profileError) {
          console.error("Error fetching profile:", profileError);
          setError("Failed to load profile information");
          setLoading(false);
          return;
        }

        setProfile(data);
        setLoading(false);
      } catch (err) {
        console.error("Unexpected error fetching profile:", err);
        setError("An unexpected error occurred");
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  // Get display name (first name, or fallback to username or email)
  const getDisplayName = () => {
    if (profile?.first_name) {
      return profile.first_name;
    }
    if (profile?.username) {
      return profile.username;
    }
    return user?.email?.split("@")[0] || "User";
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-12 md:px-8">
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-12 md:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-accent md:text-5xl">
          Welcome back, {getDisplayName()}!
        </h1>
        <p className="text-text/70">
          Your profile information
        </p>
      </div>

      {/* Profile Information Card */}
      <div className="rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm">
        <h2 className="mb-6 text-2xl font-semibold text-accent">Profile Information</h2>
        
        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        ) : profile ? (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Name Section */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text/60">Name</label>
              <p className="text-lg text-text">
                {profile.first_name}
                {profile.last_name && ` ${profile.last_name}`}
              </p>
            </div>

            {/* Username Section */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text/60">Username</label>
              <p className="text-lg text-text">@{profile.username}</p>
            </div>

            {/* Email Section */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text/60">Email</label>
              <p className="text-lg text-text">{profile.email}</p>
            </div>

            {/* Phone Section */}
            <div>
              <label className="mb-1 block text-sm font-medium text-text/60">Phone</label>
              <p className="text-lg text-text">
                {profile.phone || <span className="text-text/40">Not provided</span>}
              </p>
            </div>

            {/* Member Since Section */}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-text/60">Member Since</label>
              <p className="text-lg text-text">{formatDate(profile.created_at)}</p>
            </div>
          </div>
        ) : (
          <p className="text-text/60">No profile information available.</p>
        )}
      </div>
    </div>
  );
}
