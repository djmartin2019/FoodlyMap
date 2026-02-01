import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { validatePassword, validatePasswordConfirm } from "../lib/validation/password";
import { log } from "../lib/log";

interface FormErrors {
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();

  const { initialized, session } = useAuth();

  // Check session on mount - required for password reset
  // PASSWORD_RECOVERY events create a temporary session that must be active
  // Use auth context instead of direct getSession call
  useEffect(() => {
    if (!initialized) return;

    if (!session) {
      // No session means the recovery link is invalid or expired
      log.error("No active session for password reset");
      log.error("This usually means the recovery link has expired or was already used");
      navigate({ to: "/login", replace: true });
      return;
    }

    // Session exists - allow user to reset password
    log.log("Recovery session found, allowing password reset");
    setCheckingSession(false);
  }, [initialized, session, navigate]);

  // Validate form (using shared helper to match Supabase policy)
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Password validation
    const passwordError = validatePassword(password);
    if (passwordError) {
      newErrors.password = passwordError;
    }

    // Confirm password validation
    const confirmError = validatePasswordConfirm(password, confirmPassword);
    if (confirmError) {
      newErrors.confirmPassword = confirmError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      // Step 1: Update password via Supabase Auth
      // This uses the active recovery session to update the password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        log.error("[Reset Password] Password update error:", updateError);
        
        // Map common Supabase auth errors to friendly messages
        let errorMessage = "Failed to update password. Please try again.";
        
        const errorMsg = updateError.message?.toLowerCase() || "";
        
        if (errorMsg.includes("password") && errorMsg.includes("length")) {
          errorMessage = "Password must be at least 8 characters.";
        } else if (errorMsg.includes("different from the old password") || 
                   errorMsg.includes("same as")) {
          errorMessage = "New password must be different from your current password. Please choose a different password.";
        } else if (errorMsg.includes("invalid") || errorMsg.includes("expired")) {
          errorMessage = "This reset link is invalid or has expired. Please request a new password reset.";
        } else if (updateError.message) {
          // Use original message if it's already user-friendly
          errorMessage = updateError.message;
        }
        
        setErrors({
          general: errorMessage,
        });
        setLoading(false);
        return;
      }

      log.log("Password updated successfully");

      // Step 2: Sign out to invalidate the recovery session (non-blocking)
      // This prevents limbo states and ensures clean auth state
      // Fire and forget - don't wait for it to complete
      supabase.auth.signOut()
        .then(() => {
          log.log("Signed out successfully");
        })
        .catch((signOutError: any) => {
          log.warn("Sign out error (non-blocking):", signOutError);
        });

      // Step 3: Redirect immediately to login page
      // Don't wait for signOut - redirect right away
      // Use window.location for hard redirect to ensure it always happens
      // This clears any remaining state and ensures clean navigation
      log.log("Redirecting to login...");
      window.location.href = "/login";
    } catch (err) {
      log.error("Unexpected error during password reset:", err);
      setErrors({
        general: "An unexpected error occurred. Please try again.",
      });
      setLoading(false);
    }
  };

  // Show loading state while checking session
  if (checkingSession) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
        <div className="w-full rounded-2xl border border-surface/60 bg-surface/30 p-8 text-center shadow-neon-sm md:p-12">
          <div className="mb-4 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
          </div>
          <p className="text-sm text-text/70">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm md:p-12">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
            Reset Password
          </h1>
          <p className="text-sm text-text/70">
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Password Input */}
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-text">
              New Password
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
              placeholder="At least 8 characters"
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

          {/* Confirm Password Input */}
          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-text">
              Confirm Password
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

          {/* Error Message */}
          {errors.general && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {errors.general}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !!errors.password || !!errors.confirmPassword}
            className="w-full rounded-lg border-2 border-accent/60 bg-surface/80 px-6 py-3 text-base font-semibold text-accent shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Updating Password..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
