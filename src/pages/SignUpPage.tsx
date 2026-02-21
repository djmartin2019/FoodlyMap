import { Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";

import { useAuth } from "../contexts/AuthContext";
import { log } from "../lib/log";
import { supabase } from "../lib/supabase";
import { validatePassword, validatePasswordConfirm } from "../lib/validation/password";

interface FormErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");

  const { user, initialized } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (initialized && user) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [initialized, user, navigate]);

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!email.trim()) {
      nextErrors.email = "Email is required";
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      nextErrors.password = passwordError;
    }

    const confirmError = validatePasswordConfirm(password, confirmPassword);
    if (confirmError) {
      nextErrors.confirmPassword = confirmError;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const configuredRedirect = import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined;
      const shouldUseRedirect = !!configuredRedirect && configuredRedirect.trim().length > 0;

      const { data, error } = await supabase.auth.signUp(
        shouldUseRedirect
          ? {
              email: normalizedEmail,
              password,
              options: {
                emailRedirectTo: configuredRedirect.trim(),
              },
            }
          : {
              email: normalizedEmail,
              password,
            }
      );

      if (error) {
        const rawMessage = error.message?.toLowerCase() || "";
        let friendlyMessage = error.message || "Failed to sign up. Please try again.";

        if (
          rawMessage.includes("redirect_to") ||
          rawMessage.includes("redirect url") ||
          rawMessage.includes("redirect") ||
          rawMessage.includes("site url")
        ) {
          friendlyMessage =
            "Sign-up redirect is not configured in Supabase. Contact support or try again later.";
        } else if (
          rawMessage.includes("signups not allowed") ||
          rawMessage.includes("signup is disabled") ||
          rawMessage.includes("email signups are disabled")
        ) {
          friendlyMessage = "New sign-ups are currently disabled in Supabase Auth settings.";
        } else if (rawMessage.includes("already registered")) {
          friendlyMessage = "An account with this email already exists. Try signing in.";
        } else if (
          rawMessage.includes("captcha") ||
          rawMessage.includes("hcaptcha") ||
          rawMessage.includes("turnstile")
        ) {
          friendlyMessage =
            "Sign-up is blocked by CAPTCHA verification settings. Check Supabase Auth bot protection.";
        } else if (rawMessage.includes("email")) {
          friendlyMessage = "Please enter a valid email address.";
        }

        setErrors({ general: friendlyMessage });
        setLoading(false);
        return;
      }

      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
        return;
      }

      setSubmittedEmail(normalizedEmail);
      setConfirmationSent(true);
      setLoading(false);
    } catch (err) {
      log.error("Sign up error:", err);
      setErrors({ general: "An unexpected error occurred. Please try again." });
      setLoading(false);
    }
  };

  if (confirmationSent) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
        <div className="w-full rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm md:p-12">
          <div className="text-center">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent/60 bg-accent/10">
                <svg
                  className="h-8 w-8 text-accent"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
                Check Your Email
              </h1>
              <p className="mb-4 text-base text-text/80">
                We sent a confirmation link to <strong>{submittedEmail}</strong>
              </p>
              <p className="text-sm text-text/60">
                Open the link to finish creating your account, then sign in.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-block w-full rounded-lg border-2 border-accent/60 bg-surface/80 px-6 py-3 text-center text-base font-semibold text-accent shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow-lg"
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm md:p-12">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">Sign Up</h1>
          <p className="text-sm text-text/70">Create your account and start using Foodly Map.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-text">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
              placeholder="your@email.com"
            />
            {errors.email && <p className="mt-2 text-sm text-red-400">{errors.email}</p>}
          </div>

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
              placeholder="At least 8 characters"
            />
            {errors.password && <p className="mt-2 text-sm text-red-400">{errors.password}</p>}
          </div>

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
              placeholder="Re-enter password"
            />
            {errors.confirmPassword && (
              <p className="mt-2 text-sm text-red-400">{errors.confirmPassword}</p>
            )}
          </div>

          {errors.general && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {errors.general}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg border-2 border-accent/60 bg-surface/80 px-6 py-3 text-base font-semibold text-accent shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="mb-2 text-sm text-text/60">Already have an account?</p>
          <Link to="/login" className="text-sm font-medium text-accent/80 transition-colors hover:text-accent">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
