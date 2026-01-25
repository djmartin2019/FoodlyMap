import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "@tanstack/react-router";

export default function AppPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-6 py-12 md:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-accent md:text-5xl">
            Welcome to Foodly Map
          </h1>
          <p className="text-text/70">
            Signed in as <span className="font-medium text-text">{user?.email}</span>
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-lg border border-surface/60 bg-surface/30 px-4 py-2 text-sm font-medium text-text transition-colors hover:border-accent/60 hover:bg-surface/50"
        >
          Sign Out
        </button>
      </div>

      <div className="rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm">
        <p className="text-text/80">
          This is a protected route. Only authenticated users can access this page.
        </p>
        <p className="mt-4 text-sm text-text/60">
          App features will be built here in future phases.
        </p>
      </div>
    </div>
  );
}
