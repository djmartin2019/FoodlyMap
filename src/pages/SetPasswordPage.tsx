import { useNavigate } from "@tanstack/react-router";
import { FormEvent, useCallback,useEffect, useState } from "react";

import { RequireAuth } from "../components/RequireAuth";
import { useAuth } from "../contexts/AuthContext";
import { log } from "../lib/log";
import { supabase } from "../lib/supabase";
import { validatePassword, validatePasswordConfirm } from "../lib/validation/password";

interface FormErrors {
  password?: string;
  confirmPassword?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  general?: string;
}

// Input length limits for security
const MAX_NAME_LENGTH = 50;

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

  // RequireAuth handles auth checking and redirects
  // No need for manual session check here

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
        log.error("Error checking username:", error);
        return false;
      }

      // If data exists, username is taken
      return !data || data.length === 0;
    } catch (err) {
      log.error("Error checking username:", err);
      return false;
    } finally {
      setCheckingUsername(false);
    }
  }, []);

  // Validate form fields
  const validateForm = async (): Promise<boolean> => {
    const newErrors: FormErrors = {};

    // Password validation (using shared helper to match Supabase policy)
    const passwordError = validatePassword(password);
    if (passwordError) {
      newErrors.password = passwordError;
    }

    // Confirm password validation
    const confirmError = validatePasswordConfirm(password, confirmPassword);
    if (confirmError) {
      newErrors.confirmPassword = confirmError;
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
    const trimmedFirstName = firstName.trim();
    if (!trimmedFirstName) {
      newErrors.firstName = "First name is required";
    } else if (trimmedFirstName.length > MAX_NAME_LENGTH) {
      newErrors.firstName = `First name must be ${MAX_NAME_LENGTH} characters or less`;
    }

    // Last name validation (optional but if provided, check length)
    if (lastName.trim().length > MAX_NAME_LENGTH) {
      newErrors.lastName = `Last name must be ${MAX_NAME_LENGTH} characters or less`;
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
        error: getUserError,
      } = await supabase.auth.getUser();

      if (getUserError || !currentUser) {
        log.error("Error getting user:", getUserError);
        setErrors({ general: "Session expired. Please try again." });
        setLoading(false);
        navigate({ to: "/login" });
        return;
      }

        log.log("[Set Password] Updating password for user:", currentUser.id);

      // Step 1: Update password using supabase.auth.updateUser
      const { error: passwordError } = await supabase.auth.updateUser({
        password: password,
      });

      if (passwordError) {
        log.error("[Set Password] Error updating password:", passwordError);
        
        // Map common Supabase auth errors to friendly messages
        let errorMessage = "Failed to update password. Please try again.";
        
        const errorMsg = passwordError.message?.toLowerCase() || "";
        
        if (errorMsg.includes("password") && errorMsg.includes("length")) {
          errorMessage = "Password must be at least 8 characters.";
        } else if (errorMsg.includes("invalid") || errorMsg.includes("expired")) {
          errorMessage = "This link is invalid or has expired. Please request a new invitation.";
        } else if (passwordError.message) {
          // Use original message if it's already user-friendly
          errorMessage = passwordError.message;
        }
        
        setErrors({ general: errorMessage });
        setLoading(false);
        return;
      }

        log.log("[Set Password] Password updated successfully");

      // Step 2: Insert or update profile with onboarding_complete = true
      const profileData = {
        id: currentUser.id,
        email: currentUser.email, // Required field
        username: username.toLowerCase().trim(),
        first_name: firstName.trim().slice(0, MAX_NAME_LENGTH),
        last_name: lastName.trim() ? lastName.trim().slice(0, MAX_NAME_LENGTH) : null,
        phone: phone.trim() || null,
        onboarding_complete: true, // Mark onboarding as complete
        created_at: new Date().toISOString(),
      };

      // Log only non-sensitive fields for debugging (email, phone, and id are redacted by log utility)
      if (import.meta.env.DEV) {
        log.log("Creating profile (non-sensitive fields only):", {
          username: profileData.username,
          onboarding_complete: profileData.onboarding_complete,
        });
      }

      // Session should be valid (we're in RequireAuth wrapper)
      // No need to verify again - auth context already ensures session exists

      // Step 2: Create profile
      log.log("Creating profile...");
      
      let profileError;
      try {
        const { error: insertError } = await supabase
          .from("profiles")
          .insert(profileData);
        
        if (insertError) {
          profileError = insertError;
        }
      } catch (err: any) {
        log.error("Profile creation exception:", err);
        profileError = err;
      }

      if (profileError) {
        log.error("Profile creation error:", profileError);
        log.error("Error code:", profileError.code);
        log.error("Error message:", profileError.message);
        
        // Handle unique constraint violation (username or id)
        if (
          profileError.code === "23505" ||
          profileError.message?.includes("duplicate") ||
          profileError.message?.includes("unique")
        ) {
          // Check if it's username or id conflict
          if (profileError.message?.includes("username")) {
            setErrors({ username: "This username is already taken. Please choose another." });
          } else {
            // ID conflict - profile might already exist, try UPDATE instead
            log.log("Profile exists, trying UPDATE...");
            const { error: updateError } = await supabase
              .from("profiles")
              .update({
                email: profileData.email,
                username: profileData.username,
                first_name: profileData.first_name,
                last_name: profileData.last_name,
                phone: profileData.phone,
                onboarding_complete: profileData.onboarding_complete,
              })
              .eq("id", profileData.id);

            if (updateError) {
              log.error("Profile update also failed:", updateError);
              setErrors({
                general: `Failed to save profile: ${updateError.message || "Please try again."}`,
              });
              setLoading(false);
              return;
            }
            log.log("Profile updated successfully");
          }
        } else {
          setErrors({
            general: `Failed to save profile: ${profileError.message || "Please try again."}`,
          });
          setLoading(false);
          return;
        }
      } else {
        if (import.meta.env.DEV) {
          log.log("Profile created successfully");
        }
        
        // PostHog: Track signup (profile creation indicates new account)
        try {
          import("posthog-js").then(({ default: posthog }) => {
            posthog.capture("auth_signed_up", {
              method: "invite",
            });
          });
        } catch (e) {
          // Silently ignore PostHog errors
        }
      }

      // Success: Navigate to dashboard
      if (import.meta.env.DEV) {
        log.log("[Set Password] Onboarding complete, navigating to dashboard");
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      log.error("Unexpected error in form submission:", err);
      setErrors({
        general: `An unexpected error occurred: ${err instanceof Error ? err.message : "Please try again."}`,
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

  // Route guard handles authentication - if we reach here, user should exist
  // Show loading state if user is not yet available (shouldn't happen due to auth bootstrap)
  if (!user) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
      </div>
    );
  }

  return (
    <RequireAuth>
      <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
        <div className="w-full rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm md:p-12">
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
              Set Your Password
            </h1>
            <p className="text-sm text-text/70">
              Create your password and complete your profile to get started.
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
              onChange={(e) => {
                const newPassword = e.target.value;
                setPassword(newPassword);
                // Validate on change for immediate feedback
                const passwordError = validatePassword(newPassword);
                setErrors((prev) => ({
                  ...prev,
                  password: passwordError || undefined,
                }));
              }}
              onBlur={() => {
                // Re-validate on blur to ensure error shows if user leaves field
                const passwordError = validatePassword(password);
                setErrors((prev) => ({
                  ...prev,
                  password: passwordError || undefined,
                }));
              }}
              required
              autoComplete="new-password"
              disabled={loading}
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
              placeholder="Enter your password"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-400">{errors.password}</p>
            )}
            {!errors.password && password && (
              <p className="mt-1 text-xs text-text/50">
                Must be at least 8 characters
              </p>
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
              onChange={(e) => {
                const newConfirm = e.target.value;
                setConfirmPassword(newConfirm);
                // Validate on change for immediate feedback
                const confirmError = validatePasswordConfirm(password, newConfirm);
                setErrors((prev) => ({
                  ...prev,
                  confirmPassword: confirmError || undefined,
                }));
              }}
              onBlur={() => {
                // Re-validate on blur
                const confirmError = validatePasswordConfirm(password, confirmPassword);
                setErrors((prev) => ({
                  ...prev,
                  confirmPassword: confirmError || undefined,
                }));
              }}
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
              maxLength={MAX_NAME_LENGTH}
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
              maxLength={MAX_NAME_LENGTH}
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
                disabled={loading || checkingUsername || !!errors.password || !!errors.confirmPassword}
                className="w-full rounded-lg border-2 border-accent/60 bg-surface/80 px-6 py-3 text-base font-semibold text-accent shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Setting up account..." : "Complete Setup"}
              </button>
            </form>
        </div>
      </div>
    </RequireAuth>
  );
}
