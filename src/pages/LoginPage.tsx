import { useState, FormEvent } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  // Handle form submission
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

    // Success: redirect to protected route
    // The auth context will update, and route protection will allow access
    navigate({ to: "/app" });
  };

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
