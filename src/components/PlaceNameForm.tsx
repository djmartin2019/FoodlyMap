import { useState, FormEvent, useEffect, useRef } from "react";
import CategorySelect from "./CategorySelect";
import { reverseGeocode } from "../lib/mapbox";

interface Category {
  id: string;
  name: string;
}

export interface GeocodedAddress {
  display_address: string;
  address_line1: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  mapbox_place_id: string | null;
  distance_m?: number | null;
  place_type?: string | null;
  feature_center?: { lat: number; lng: number } | null;
}

interface PlaceNameFormProps {
  onSubmit: (name: string, categoryId: string | null, geocodedAddress: GeocodedAddress | null) => void;
  onCancel: () => void;
  loading?: boolean;
  categories: Category[];
  onCategoryCreated?: (category: Category) => void;
  coordinates?: { lat: number; lng: number } | null;
}

/**
 * PlaceNameForm Component
 * 
 * Simple form for naming a new place.
 * Used after user clicks "Place Here" in ADD_PLACE mode.
 */
export default function PlaceNameForm({ 
  onSubmit, 
  onCancel, 
  loading = false,
  categories,
  onCategoryCreated,
  coordinates,
}: PlaceNameFormProps) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geocodedAddress, setGeocodedAddress] = useState<GeocodedAddress | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reverse geocode when coordinates are available
  useEffect(() => {
    if (!coordinates) {
      setGeocodedAddress(null);
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce geocoding (300ms)
    setGeocoding(true);
    debounceTimerRef.current = setTimeout(async () => {
      const result = await reverseGeocode({
        latitude: coordinates.lat,
        longitude: coordinates.lng,
      });
      setGeocodedAddress(result);
      setGeocoding(false);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [coordinates]);

  // Handle re-detect address
  const handleRedetectAddress = async () => {
    if (!coordinates) return;
    setGeocoding(true);
    const result = await reverseGeocode({
      latitude: coordinates.lat,
      longitude: coordinates.lng,
    });
    setGeocodedAddress(result);
    setGeocoding(false);
  };

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

    onSubmit(trimmedName, categoryId, geocodedAddress);
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

          {/* Geocoded address preview */}
          {coordinates && (
            <div className="mb-4">
              {geocoding ? (
                <div className="text-xs text-text/50">Detecting address...</div>
              ) : geocodedAddress ? (
                <div className="space-y-1">
                  <div className="text-xs text-text/50">Detected address:</div>
                  <div className="text-sm text-text/80">{geocodedAddress.display_address}</div>
                  <button
                    type="button"
                    onClick={handleRedetectAddress}
                    className="text-xs text-accent/70 hover:text-accent transition-colors"
                    disabled={geocoding}
                  >
                    Re-detect
                  </button>
                </div>
              ) : null}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="place-category" className="mb-2 block text-sm font-medium text-text/70">
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
