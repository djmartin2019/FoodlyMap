import { useState, FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const { signIn, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Handle login form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Attempt sign in
    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      // Display user-friendly error message
      setError(signInError.message || "Invalid email or password");
      setLoading(false);
      return;
    }

    // Success: Wait for auth state to stabilize before navigating
    // This prevents navigation from happening during auth state transitions,
    // which can cause the router to update the URL but not re-render.
    // The auth context's onAuthStateChange will fire SIGNED_IN event,
    // which updates the auth state. We wait for loading to complete.
    try {
      // Wait for auth loading to complete (max 1 second)
      // This ensures the auth context has finished processing the sign-in event
      const maxWait = 1000;
      const startTime = Date.now();
      while (authLoading && (Date.now() - startTime) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("onboarding_complete")
        .eq("id", session.user.id)
        .single();

      const isComplete = profileError 
        ? false 
        : (profile?.onboarding_complete ?? false);

      setLoading(false);
      // Navigate directly to the correct page based on onboarding status
      // Use requestAnimationFrame to ensure DOM is ready for navigation
      requestAnimationFrame(() => {
        navigate({ to: isComplete ? "/dashboard" : "/set-password", replace: true });
      });
    } catch (err) {
      // If check fails, default to /dashboard (route guard will handle it)
      setLoading(false);
      requestAnimationFrame(() => {
        navigate({ to: "/dashboard", replace: true });
      });
    }
  };

  // Handle forgot password form submission
  const handleForgotPassword = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setForgotPasswordLoading(true);

    try {
      // Send password reset email via Supabase
      // The redirectTo URL must match your deployed domain
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        forgotPasswordEmail,
        {
          redirectTo: "https://foodlymap.com/reset-password",
        }
      );

      if (resetError) {
        setError(resetError.message || "Failed to send reset email. Please try again.");
        setForgotPasswordLoading(false);
        return;
      }

      // Show success message
      setForgotPasswordSent(true);
      setForgotPasswordLoading(false);
    } catch (err) {
      console.error("Error sending password reset:", err);
      setError("An unexpected error occurred. Please try again.");
      setForgotPasswordLoading(false);
    }
  };

  // Show forgot password form
  if (showForgotPassword) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
        <div className="w-full rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm md:p-12">
          {forgotPasswordSent ? (
            <div className="text-center">
              <div className="mb-6">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent/60 bg-accent/10">
                  <svg className="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
                  Check Your Email
                </h1>
                <p className="mb-4 text-base text-text/80">
                  We've sent a password reset link to <strong>{forgotPasswordEmail}</strong>
                </p>
                <p className="text-sm text-text/60">
                  Click the link in the email to reset your password. The link will expire in 1 hour.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotPasswordSent(false);
                  setForgotPasswordEmail("");
                }}
                className="w-full rounded-lg border-2 border-accent/60 bg-surface/80 px-6 py-3 text-base font-semibold text-accent shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow-lg"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8 text-center">
                <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
                  Forgot Password?
                </h1>
                <p className="text-sm text-text/70">
                  Enter your email address and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-6">
                {/* Email Input */}
                <div>
                  <label htmlFor="forgotEmail" className="mb-2 block text-sm font-medium text-text">
                    Email
                  </label>
                  <input
                    id="forgotEmail"
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={forgotPasswordLoading}
                    className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
                    placeholder="your@email.com"
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
                  disabled={forgotPasswordLoading}
                  className="w-full rounded-lg border-2 border-accent/60 bg-surface/80 px-6 py-3 text-base font-semibold text-accent shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {forgotPasswordLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>

              {/* Back to Login */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => {
                    setShowForgotPassword(false);
                    setError(null);
                    setForgotPasswordEmail("");
                  }}
                  className="text-sm font-medium text-accent/80 transition-colors hover:text-accent"
                >
                  Back to Sign In
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm md:p-12">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
            Sign In
          </h1>
          <p className="text-sm text-text/70">
            Closed beta access only. Contact admin for credentials.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email Input */}
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
          </div>

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
              autoComplete="current-password"
              disabled={loading}
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
              placeholder="••••••••"
            />
          </div>

          {/* Forgot Password Link */}
          <div className="text-right">
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="text-sm font-medium text-accent/80 transition-colors hover:text-accent"
            >
              Forgot password?
            </button>
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
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        {/* Join Beta Link */}
        <div className="mt-6 text-center">
          <p className="mb-2 text-sm text-text/60">Don't have access yet?</p>
          <Link
            to="/request-access"
            className="text-sm font-medium text-accent/80 transition-colors hover:text-accent"
          >
            Join the Beta
          </Link>
        </div>
      </div>
    </div>
  );
}
