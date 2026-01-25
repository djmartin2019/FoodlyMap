import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export default function ResetPasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if user is authenticated (should be from password reset link)
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          // No session - redirect to login
          navigate({ to: "/login", replace: true });
        }
      } catch (error) {
        console.error("Error checking session:", error);
        navigate({ to: "/login", replace: true });
      }
    };
    checkSession();
  }, [navigate]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate passwords
    if (!password) {
      setError("Password is required");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message || "Failed to update password. Please try again.");
        setLoading(false);
        return;
      }

      // Success - show success message and redirect
      setSuccess(true);
      setTimeout(() => {
        navigate({ to: "/dashboard", replace: true });
      }, 2000);
    } catch (err) {
      console.error("Error updating password:", err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
        <div className="w-full rounded-2xl border border-surface/60 bg-surface/30 p-8 text-center shadow-neon-sm md:p-12">
          <div className="mb-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent/60 bg-accent/10">
              <svg className="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
              Password Set!
            </h1>
            <p className="text-base text-text/80">
              Your password has been successfully set. Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm md:p-12">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
            Set Your Password
          </h1>
          <p className="text-sm text-text/70">
            Enter a new password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Password Input */}
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-text">
              Password
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
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              disabled={loading}
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
              placeholder="Confirm your password"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg border-2 border-accent/60 bg-surface/80 px-6 py-3 text-base font-semibold text-accent shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Setting Password..." : "Set Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
