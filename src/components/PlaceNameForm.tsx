import { useState, FormEvent } from "react";

interface PlaceNameFormProps {
  onSubmit: (name: string) => void;
  onCancel: () => void;
  loading?: boolean;
}

/**
 * PlaceNameForm Component
 * 
 * Simple form for naming a new place.
 * Used after user clicks "Place Here" in ADD_PLACE mode.
 */
export default function PlaceNameForm({ onSubmit, onCancel, loading = false }: PlaceNameFormProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter a name for this place");
      return;
    }

    if (trimmedName.length > 100) {
      setError("Name must be 100 characters or less");
      return;
    }

    onSubmit(trimmedName);
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-bg/95 backdrop-blur-sm p-4">
      {/* Mobile: Full-width with padding, Desktop: Max-width centered */}
      <div className="w-full max-w-md rounded-2xl border border-surface/60 bg-surface/30 p-6 shadow-neon-md sm:p-8">
        <h3 className="mb-4 text-xl font-semibold text-accent sm:text-2xl">Name This Place</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="place-name" className="mb-2 block text-sm font-medium text-text/70">
              Place Name
            </label>
            <input
              id="place-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g., The Breakfast Klub"
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-base text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:py-2 sm:text-sm"
              autoFocus
              disabled={loading}
              maxLength={100}
            />
            {error && (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 rounded-lg border border-surface/60 bg-surface/30 px-4 py-3 text-base font-medium text-text transition-colors active:bg-surface/50 disabled:opacity-50 sm:py-2 sm:text-sm hover:border-accent/60 hover:bg-surface/50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 rounded-lg border border-accent/60 bg-accent/15 px-4 py-3 text-base font-medium text-accent transition-colors active:bg-accent/20 disabled:opacity-50 sm:py-2 sm:text-sm hover:border-accent hover:bg-accent/20"
            >
              {loading ? "Saving..." : "Save Place"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
