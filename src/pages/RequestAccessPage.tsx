import { useState, FormEvent } from "react";
import { supabase } from "../lib/supabase";

export default function RequestAccessPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Simple email validation
  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate email
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      // Insert email into beta_requests table
      const { error: insertError } = await supabase
        .from("beta_requests")
        .insert([{ email: email.trim().toLowerCase() }]);

      if (insertError) {
        // Handle duplicate email (unique constraint violation)
        if (insertError.code === "23505" || insertError.message.includes("duplicate")) {
          // Still show success message to prevent email enumeration
          setSubmitted(true);
        } else {
          // Other errors - show generic message
          setError("Something went wrong. Please try again later.");
        }
      } else {
        // Success
        setSubmitted(true);
      }
    } catch (err) {
      // Catch any unexpected errors
      setError("Something went wrong. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // Show confirmation message after successful submission
  if (submitted) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
        <div className="w-full rounded-2xl border border-surface/60 bg-surface/30 p-8 text-center shadow-neon-sm md:p-12">
          <div className="mb-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent/60 bg-accent/10">
              <svg
                className="h-8 w-8 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
              Thanks!
            </h1>
            <p className="text-base text-text/80">
              We'll review your request and contact you if access opens.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show form
  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm md:p-12">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
            Request Beta Access
          </h1>
          <p className="text-sm text-text/70">
            Foodly Map is currently in closed beta. Leave your email and we'll reach out if we open
            access.
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
            {loading ? "Submitting..." : "Request Access"}
          </button>
        </form>
      </div>
    </div>
  );
}
