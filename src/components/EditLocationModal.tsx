import { useState, FormEvent, useEffect } from "react";
import { Location } from "./LocationsTable";
import CategorySelect from "./CategorySelect";

interface Category {
  id: string;
  name: string;
}

interface EditLocationModalProps {
  location: Location;
  categories: Category[];
  onSave: (locationId: string, name: string, categoryId: string | null) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  onCategoryCreated?: (category: Category) => void;
}

/**
 * EditLocationModal Component
 * 
 * Modal form for editing a location's name and category.
 * Pre-fills with current location data.
 */
export default function EditLocationModal({
  location,
  categories,
  onSave,
  onCancel,
  loading = false,
  onCategoryCreated,
}: EditLocationModalProps) {
  const [name, setName] = useState(location.name);
  const [categoryId, setCategoryId] = useState<string | null>(location.category_id || null);
  const [error, setError] = useState<string | null>(null);

  // Update form when location changes
  useEffect(() => {
    setName(location.name);
    setCategoryId(location.category_id || null);
    setError(null);
  }, [location]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Location name is required");
      return;
    }

    if (trimmedName.length > 100) {
      setError("Name must be 100 characters or less");
      return;
    }

    try {
      await onSave(location.id, trimmedName, categoryId);
    } catch (err) {
      setError("Failed to update location. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-surface/60 bg-surface/30 p-6 shadow-neon-md sm:p-8">
        <h3 className="mb-4 text-xl font-semibold text-accent sm:text-2xl">Edit Location</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="edit-location-name" className="mb-2 block text-sm font-medium text-text/70">
              Location Name
            </label>
            <input
              id="edit-location-name"
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
          </div>

          <div className="mb-4">
            <label htmlFor="edit-location-category" className="mb-2 block text-sm font-medium text-text/70">
              Category
            </label>
            <CategorySelect
              value={categoryId}
              onChange={setCategoryId}
              categories={categories}
              onCategoryCreated={onCategoryCreated}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

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
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
