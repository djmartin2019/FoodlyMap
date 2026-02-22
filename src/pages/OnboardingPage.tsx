import { useNavigate } from "@tanstack/react-router";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { useAuth } from "../contexts/AuthContext";
import { log } from "../lib/log";
import { supabase } from "../lib/supabase";

interface FormErrors {
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  general?: string;
}

interface ExistingProfile {
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  onboarding_complete: boolean | null;
}

const MAX_NAME_LENGTH = 50;

export default function OnboardingPage() {
  const { user, initialized } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  const validateUsernameFormat = (value: string): boolean => {
    return /^[a-z0-9_]+$/.test(value) && value.length >= 3 && value.length <= 30;
  };

  const checkUsernameUniqueness = useCallback(
    async (value: string): Promise<boolean> => {
      if (!user || !validateUsernameFormat(value)) {
        return false;
      }

      setCheckingUsername(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", value.toLowerCase())
          .neq("id", user.id)
          .limit(1);

        if (error && error.code !== "PGRST116") {
          log.error("Error checking username uniqueness:", error);
          return false;
        }

        return !data || data.length === 0;
      } catch (err) {
        log.error("Unexpected username check error:", err);
        return false;
      } finally {
        setCheckingUsername(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    const currentUser = user;

    let mounted = true;
    async function bootstrapProfile() {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("username,first_name,last_name,phone,onboarding_complete")
          .eq("id", currentUser.id)
          .maybeSingle<ExistingProfile>();

        if (error && error.code !== "PGRST116") {
          log.error("Error loading onboarding profile:", error);
        }

        if (!mounted) return;

        if (data?.onboarding_complete) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }

        if (data) {
          setUsername(data.username ?? "");
          setFirstName(data.first_name ?? "");
          setLastName(data.last_name ?? "");
          setPhone(data.phone ?? "");
        }
      } catch (err) {
        log.error("Unexpected onboarding bootstrap error:", err);
      } finally {
        if (mounted) {
          setBootstrapping(false);
        }
      }
    }

    bootstrapProfile();
    return () => {
      mounted = false;
    };
  }, [initialized, user, navigate]);

  useEffect(() => {
    if (!username || !validateUsernameFormat(username)) {
      setUsernameAvailable(null);
      return;
    }

    const timeout = setTimeout(() => {
      checkUsernameUniqueness(username).then((isAvailable) => {
        setUsernameAvailable(isAvailable);
        if (!isAvailable) {
          setErrors((prev) => ({
            ...prev,
            username: "This username is already taken",
          }));
        }
      });
    }, 400);

    return () => clearTimeout(timeout);
  }, [username, checkUsernameUniqueness]);

  const validateForm = async (): Promise<boolean> => {
    const nextErrors: FormErrors = {};

    if (!username) {
      nextErrors.username = "Username is required";
    } else if (!validateUsernameFormat(username)) {
      nextErrors.username =
        "Username must be 3-30 characters, lowercase, and contain only letters, numbers, and underscores";
    } else {
      const isAvailable = await checkUsernameUniqueness(username);
      if (!isAvailable) {
        nextErrors.username = "This username is already taken";
      }
    }

    const trimmedFirstName = firstName.trim();
    if (!trimmedFirstName) {
      nextErrors.firstName = "First name is required";
    } else if (trimmedFirstName.length > MAX_NAME_LENGTH) {
      nextErrors.firstName = `First name must be ${MAX_NAME_LENGTH} characters or less`;
    }

    if (lastName.trim().length > MAX_NAME_LENGTH) {
      nextErrors.lastName = `Last name must be ${MAX_NAME_LENGTH} characters or less`;
    }

    if (phone && !/^\+?[\d\s\-()]+$/.test(phone)) {
      nextErrors.phone = "Please enter a valid phone number";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    if (!user) return;

    const isValid = await validateForm();
    if (!isValid) return;

    setLoading(true);
    const normalizedUsername = username.toLowerCase().trim();

    const profilePayload = {
      email: user.email || null,
      username: normalizedUsername,
      first_name: firstName.trim().slice(0, MAX_NAME_LENGTH),
      last_name: lastName.trim() ? lastName.trim().slice(0, MAX_NAME_LENGTH) : null,
      phone: phone.trim() || null,
      onboarding_complete: true,
    };

    try {
      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update(profilePayload)
        .eq("id", user.id)
        .select("id")
        .maybeSingle();

      if (updateError) {
        log.error("Error updating onboarding profile:", updateError);
        setErrors({ general: updateError.message || "Failed to save profile. Please try again." });
        setLoading(false);
        return;
      }

      if (!updatedProfile) {
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          ...profilePayload,
          created_at: new Date().toISOString(),
        });

        if (insertError) {
          log.error("Error inserting onboarding profile:", insertError);
          setErrors({ general: insertError.message || "Failed to save profile. Please try again." });
          setLoading(false);
          return;
        }
      }

      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      log.error("Unexpected onboarding submit error:", err);
      setErrors({
        general: err instanceof Error ? err.message : "An unexpected error occurred. Please try again.",
      });
      setLoading(false);
    }
  };

  if (!initialized || bootstrapping) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm md:p-12">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
            Complete Your Profile
          </h1>
          <p className="text-sm text-text/70">
            Add a few details to finish onboarding and start using Foodly Map.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="username" className="mb-2 block text-sm font-medium text-text">
              Username <span className="text-text/50">(required)</span>
            </label>
            <div className="relative">
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                  setUsername(value);
                  setErrors((prev) => ({ ...prev, username: undefined }));
                }}
                required
                autoComplete="username"
                disabled={loading}
                className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
                placeholder="username123"
              />
              {checkingUsername && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
                </div>
              )}
              {usernameAvailable === true && !checkingUsername && username && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            {errors.username && <p className="mt-1 text-xs text-red-400">{errors.username}</p>}
          </div>

          <div>
            <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-text">
              First Name <span className="text-text/50">(required)</span>
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
              disabled={loading}
              maxLength={MAX_NAME_LENGTH}
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
              placeholder="John"
            />
            {errors.firstName && <p className="mt-1 text-xs text-red-400">{errors.firstName}</p>}
          </div>

          <div>
            <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-text">
              Last Name <span className="text-text/50">(optional)</span>
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              disabled={loading}
              maxLength={MAX_NAME_LENGTH}
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
              placeholder="Doe"
            />
            {errors.lastName && <p className="mt-1 text-xs text-red-400">{errors.lastName}</p>}
          </div>

          <div>
            <label htmlFor="phone" className="mb-2 block text-sm font-medium text-text">
              Phone Number <span className="text-text/50">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              disabled={loading}
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
              placeholder="+1 (555) 123-4567"
            />
            {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone}</p>}
          </div>

          {errors.general && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {errors.general}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || checkingUsername}
            className="w-full rounded-lg border-2 border-accent/60 bg-surface/80 px-6 py-3 text-base font-semibold text-accent shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Saving..." : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
