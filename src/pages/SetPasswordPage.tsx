import { useState, FormEvent, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface FormErrors {
  password?: string;
  confirmPassword?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  general?: string;
}

export default function SetPasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/login" });
      }
    };
    checkSession();
  }, [navigate]);

  // Validate username format
  const validateUsernameFormat = (value: string): boolean => {
    return /^[a-z0-9_]+$/.test(value) && value.length >= 3 && value.length <= 30;
  };

  // Check username uniqueness (memoized to avoid recreating on each render)
  const checkUsernameUniqueness = useCallback(async (value: string): Promise<boolean> => {
    if (!validateUsernameFormat(value)) {
      return false;
    }

    setCheckingUsername(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", value.toLowerCase())
        .limit(1);

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "no rows returned" which is fine
        console.error("Error checking username:", error);
        return false;
      }

      // If data exists, username is taken
      return !data || data.length === 0;
    } catch (err) {
      console.error("Error checking username:", err);
      return false;
    } finally {
      setCheckingUsername(false);
    }
  }, []);

  // Validate form fields
  const validateForm = async (): Promise<boolean> => {
    const newErrors: FormErrors = {};

    // Password validation
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    // Confirm password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    // Username validation
    if (!username) {
      newErrors.username = "Username is required";
    } else if (!validateUsernameFormat(username)) {
      newErrors.username =
        "Username must be 3-30 characters, lowercase, and contain only letters, numbers, and underscores";
    } else {
      // Check uniqueness
      const isAvailable = await checkUsernameUniqueness(username);
      if (!isAvailable) {
        newErrors.username = "This username is already taken";
        setUsernameAvailable(false);
      } else {
        setUsernameAvailable(true);
      }
    }

    // First name validation
    if (!firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    // Phone validation (optional but if provided, should be valid format)
    if (phone && !/^\+?[\d\s\-()]+$/.test(phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    // Validate form
    const isValid = await validateForm();
    if (!isValid) {
      return;
    }

    setLoading(true);

    try {
      // Get current user
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        setErrors({ general: "Session expired. Please try again." });
        navigate({ to: "/login" });
        return;
      }

      // Step 1: Update password
      const { error: passwordError } = await supabase.auth.updateUser({
        password: password,
      });

      if (passwordError) {
        setErrors({
          general: passwordError.message || "Failed to update password. Please try again.",
        });
        setLoading(false);
        return;
      }

      // Step 2: Insert or update profile
      const profileData = {
        id: currentUser.id,
        username: username.toLowerCase().trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        phone: phone.trim() || null,
        created_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase.from("profiles").upsert(profileData, {
        onConflict: "id",
      });

      if (profileError) {
        // Handle unique constraint violation
        if (profileError.code === "23505" || profileError.message.includes("duplicate")) {
          setErrors({ username: "This username is already taken. Please choose another." });
        } else {
          setErrors({
            general: "Failed to save profile. Please try again.",
          });
        }
        setLoading(false);
        return;
      }

      // Success: Show brief success state then redirect
      // Small delay to show success feedback
      await new Promise((resolve) => setTimeout(resolve, 500));
      navigate({ to: "/app" });
    } catch (err) {
      setErrors({
        general: "An unexpected error occurred. Please try again.",
      });
      setLoading(false);
    }
  };

  // Debounced username check
  useEffect(() => {
    if (!username || !validateUsernameFormat(username)) {
      setUsernameAvailable(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      checkUsernameUniqueness(username).then((available) => {
        setUsernameAvailable(available);
        if (!available && username) {
          setErrors((prev) => ({
            ...prev,
            username: "This username is already taken",
          }));
        }
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username, checkUsernameUniqueness]);

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm md:p-12">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
            Finish Setting Up Your Account
          </h1>
          <p className="text-sm text-text/70">
            Complete your profile to get started. This is a one-time setup.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Password */}
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-text">
              Password <span className="text-text/50">(required)</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              disabled={loading}
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
              placeholder="At least 6 characters"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-text">
              Confirm Password <span className="text-text/50">(required)</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              disabled={loading}
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
              placeholder="Confirm your password"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-red-400">{errors.confirmPassword}</p>
            )}
          </div>

          {/* Username */}
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
                  <svg
                    className="h-4 w-4 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </div>
            {errors.username && (
              <p className="mt-1 text-xs text-red-400">{errors.username}</p>
            )}
            {!errors.username && username && validateUsernameFormat(username) && (
              <p className="mt-1 text-xs text-text/50">
                Use lowercase letters, numbers, and underscores only
              </p>
            )}
          </div>

          {/* First Name */}
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
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
              placeholder="John"
            />
            {errors.firstName && (
              <p className="mt-1 text-xs text-red-400">{errors.firstName}</p>
            )}
          </div>

          {/* Last Name */}
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
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
              placeholder="Doe"
            />
            {errors.lastName && (
              <p className="mt-1 text-xs text-red-400">{errors.lastName}</p>
            )}
          </div>

          {/* Phone */}
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

          {/* General Error Message */}
          {errors.general && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {errors.general}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || checkingUsername}
            className="w-full rounded-lg border-2 border-accent/60 bg-surface/80 px-6 py-3 text-base font-semibold text-accent shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Setting up..." : "Complete Setup"}
          </button>
        </form>
      </div>
    </div>
  );
}
