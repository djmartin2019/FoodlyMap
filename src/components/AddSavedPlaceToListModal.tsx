import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface Place {
  id: string;
  name: string;
  display_address: string | null;
  address_line1: string | null;
  city: string | null;
  region: string | null;
}

interface AddSavedPlaceToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
  listName?: string;
  onSaved?: () => void;
}

export default function AddSavedPlaceToListModal({
  isOpen,
  onClose,
  listId,
  listName,
  onSaved,
}: AddSavedPlaceToListModalProps) {
  const { user } = useAuth();
  const [places, setPlaces] = useState<Place[]>([]);
  const [existingPlaceIds, setExistingPlaceIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasHiddenPlaces, setHasHiddenPlaces] = useState(false);

  // Load user's saved places AND existing list places
  useEffect(() => {
    if (!isOpen || !user || !listId) {
      setPlaces([]);
      setExistingPlaceIds(new Set());
      setSelectedPlaceIds(new Set());
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load candidate places (user's saved places)
        const { data: placesData, error: placesError } = await supabase
          .from("user_places")
          .select("place_id, places(id, name, display_address, address_line1, city, region)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (placesError) {
          if (import.meta.env.DEV) {
            console.error("Error loading places:", placesError);
          }
          setError("Failed to load places");
          setLoading(false);
          return;
        }

        // Transform the data to extract places
        // Defensive filtering: ensure places exist and have required fields
        const userPlaces: Place[] = (placesData || [])
          .filter((up: any) => {
            if (!up || !up.places) return false;
            const place = up.places;
            return (
              typeof place === 'object' &&
              !Array.isArray(place) &&
              typeof place.id === 'string' &&
              typeof place.name === 'string'
            );
          })
          .map((up: any) => up.places) as Place[];

        setPlaces(userPlaces);
        const candidatePlaceIds = new Set(userPlaces.map((p) => p.id));

        // Load existing list places
        const { data: listPlacesData, error: listPlacesError } = await supabase
          .from("list_places")
          .select("id, place_id")
          .eq("list_id", listId);

        if (listPlacesError) {
          if (import.meta.env.DEV) {
            console.error("Error loading list places:", listPlacesError);
          }
          setError("Failed to load list");
          setLoading(false);
          return;
        }

        const existingIds = new Set(
          (listPlacesData || []).map((lp: any) => lp.place_id)
        );
        setExistingPlaceIds(existingIds);

        // Check if there are places in the list that aren't in user's saved places
        const hiddenCount = Array.from(existingIds).filter(
          (id) => !candidatePlaceIds.has(id)
        ).length;
        setHasHiddenPlaces(hiddenCount > 0);

        // Pre-select: intersection of existing and candidate
        const preselected = new Set(
          Array.from(existingIds).filter((id) => candidatePlaceIds.has(id))
        );
        setSelectedPlaceIds(preselected);

        setLoading(false);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Unexpected error loading data:", err);
        }
        setError("An unexpected error occurred");
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, user, listId]);

  // Filter places by search query
  const filteredPlaces = useMemo(() => {
    if (!searchQuery.trim()) return places;
    const query = searchQuery.toLowerCase();
    return places.filter(
      (place) =>
        place.name.toLowerCase().includes(query) ||
        place.display_address?.toLowerCase().includes(query) ||
        place.address_line1?.toLowerCase().includes(query) ||
        place.city?.toLowerCase().includes(query)
    );
  }, [places, searchQuery]);

  // Calculate diff
  const diff = useMemo(() => {
    const toAdd = Array.from(selectedPlaceIds).filter(
      (id) => !existingPlaceIds.has(id)
    );
    const toRemove = Array.from(existingPlaceIds).filter(
      (id) => !selectedPlaceIds.has(id)
    );
    return { toAdd, toRemove };
  }, [selectedPlaceIds, existingPlaceIds]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  // Toggle place selection
  const togglePlace = (placeId: string) => {
    const newSelected = new Set(selectedPlaceIds);
    if (newSelected.has(placeId)) {
      newSelected.delete(placeId);
    } else {
      newSelected.add(placeId);
    }
    setSelectedPlaceIds(newSelected);
  };

  // Get status for a place
  const getPlaceStatus = (placeId: string) => {
    const isExisting = existingPlaceIds.has(placeId);
    const isSelected = selectedPlaceIds.has(placeId);

    if (isExisting && isSelected) {
      return "in_list";
    } else if (isExisting && !isSelected) {
      return "will_remove";
    } else if (!isExisting && isSelected) {
      return "will_add";
    }
    return null;
  };

  // Handle save changes
  const handleSave = async () => {
    if (!user || !listId) return;

    // Check if there are any changes
    if (diff.toAdd.length === 0 && diff.toRemove.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Add new places
      if (diff.toAdd.length > 0) {
        const listPlacesToInsert = diff.toAdd.map((placeId) => ({
          list_id: listId,
          place_id: placeId,
        }));

        const { error: upsertError } = await supabase
          .from("list_places")
          .upsert(listPlacesToInsert, {
            onConflict: "list_id,place_id",
            ignoreDuplicates: true,
          });

        if (upsertError) {
          if (import.meta.env.DEV) {
            console.error("Error adding places to list:", upsertError);
          }
          setError("Couldn't update list. Try again.");
          setSaving(false);
          return;
        }
      }

      // Remove unchecked places
      if (diff.toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("list_places")
          .delete()
          .eq("list_id", listId)
          .in("place_id", diff.toRemove);

        if (deleteError) {
          if (import.meta.env.DEV) {
            console.error("Error removing places from list:", deleteError);
          }
          setError("Couldn't update list. Try again.");
          setSaving(false);
          return;
        }
      }

      setSuccess(true);
      setSaving(false);

      // Call onSaved callback and close after brief delay
      if (onSaved) {
        onSaved();
      }
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Unexpected error saving changes:", err);
      }
      setError("An unexpected error occurred");
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  if (!user) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl rounded-lg border border-surface/60 bg-surface/30 p-6 shadow-neon-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-text">Edit List Places</h2>
            <button
              onClick={onClose}
              className="text-text/60 transition-colors hover:text-text"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <p className="text-text/60">Log in to manage lists.</p>
        </div>
      </div>
    );
  }

  const hasChanges = diff.toAdd.length > 0 || diff.toRemove.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-surface/60 bg-surface/30 p-6 shadow-neon-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text">
              {listName ? `Edit places in "${listName}"` : "Edit places in list"}
            </h2>
            <p className="mt-1 text-xs text-text/60">
              Checked = in list. Uncheck to remove.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text/60 transition-colors hover:text-text"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent">
            Changes saved!
          </div>
        )}

        {hasHiddenPlaces && (
          <div className="mb-4 rounded-lg border border-surface/60 bg-bg/40 px-4 py-2 text-xs text-text/60">
            Some places in this list aren't in your saved places and can't be edited here.
          </div>
        )}

        {/* Search input */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search places..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-surface/60 bg-bg px-4 py-2 text-text placeholder:text-text/40 focus:border-accent focus:outline-none"
          />
        </div>

        {/* Places list */}
        <div className="flex-1 overflow-y-auto mb-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
            </div>
          ) : filteredPlaces.length === 0 ? (
            <div className="rounded-lg border border-surface/60 bg-bg/40 p-8 text-center">
              <p className="text-text/60">
                {searchQuery ? "No places match your search" : "No saved places yet"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPlaces.map((place) => {
                const addressParts = [place.address_line1, place.city, place.region].filter(Boolean);
                const shortAddress = addressParts.length > 0 ? addressParts.join(", ") : place.display_address;
                const isSelected = selectedPlaceIds.has(place.id);
                const status = getPlaceStatus(place.id);

                return (
                  <label
                    key={place.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      isSelected
                        ? "border-accent/60 bg-accent/10"
                        : "border-surface/60 bg-bg/40 hover:border-surface/80"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePlace(place.id)}
                      className="mt-1 h-4 w-4 rounded border-surface/60 bg-bg text-accent focus:ring-accent/50"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-text">{place.name}</div>
                        {status && (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              status === "in_list"
                                ? "bg-accent/20 text-accent/80"
                                : status === "will_remove"
                                ? "bg-red-500/20 text-red-400/80"
                                : "bg-blue-500/20 text-blue-400/80"
                            }`}
                          >
                            {status === "in_list"
                              ? "In list"
                              : status === "will_remove"
                              ? "Will remove"
                              : "Will add"}
                          </span>
                        )}
                      </div>
                      {shortAddress && (
                        <div className="mt-1 text-sm text-text/60">{shortAddress}</div>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-surface/60 pt-4">
          <div className="text-sm text-text/60">
            {hasChanges ? (
              <span>
                {diff.toAdd.length > 0 && `${diff.toAdd.length} to add`}
                {diff.toAdd.length > 0 && diff.toRemove.length > 0 && ", "}
                {diff.toRemove.length > 0 && `${diff.toRemove.length} to remove`}
              </span>
            ) : (
              <span>No changes</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg border border-surface/60 bg-surface/30 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface/50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="rounded-lg border border-accent/60 bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
