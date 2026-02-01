import { useEffect,useState } from "react";

import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface List {
  id: string;
  name: string;
  visibility: "private" | "public";
  slug: string;
  created_at: string;
}

interface AddToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  place: { id: string; name: string };
  defaultListId?: string;
}

export default function AddToListModal({
  isOpen,
  onClose,
  place,
  defaultListId,
}: AddToListModalProps) {
  const { user } = useAuth();
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedListId, setSelectedListId] = useState<string>(defaultListId || "");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListVisibility, setNewListVisibility] = useState<"private" | "public">("private");
  const [creating, setCreating] = useState(false);

  // Load user's lists when modal opens
  useEffect(() => {
    if (!isOpen || !user) {
      setLists([]);
      return;
    }

    const loadLists = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("lists")
          .select("id, name, visibility, slug, created_at")
          .eq("owner_id", user.id)
          .order("created_at", { ascending: false });

        if (fetchError) {
          // Log in dev only
          if (import.meta.env.DEV) {
            console.error("Error loading lists:", fetchError);
          }
          setError("Failed to load lists");
          setLoading(false);
          return;
        }

        setLists(data || []);
        if (defaultListId && data?.some((l) => l.id === defaultListId)) {
          setSelectedListId(defaultListId);
        } else if (data && data.length > 0 && !selectedListId) {
          setSelectedListId(data[0].id);
        }
        setLoading(false);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Unexpected error loading lists:", err);
        }
        setError("An unexpected error occurred");
        setLoading(false);
      }
    };

    loadLists();
  }, [isOpen, user, defaultListId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedListId(defaultListId || "");
      setError(null);
      setSuccess(false);
      setShowCreateForm(false);
      setNewListName("");
      setNewListVisibility("private");
    }
  }, [isOpen, defaultListId]);

  // Handle create new list and add place (Create & Add button)
  const handleCreateList = async () => {
    if (!user || !newListName.trim()) {
      setError("List name is required");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // Step 1: Create the list and get the ID
      const { data: newList, error: createError } = await supabase
        .from("lists")
        .insert([
          {
            owner_id: user.id,
            name: newListName.trim(),
            visibility: newListVisibility,
          },
        ])
        .select("id")
        .single();

      if (createError) {
        if (import.meta.env.DEV) {
          console.error("Error creating list:", createError);
        }
        setError("Failed to create list");
        setCreating(false);
        return;
      }

      // Safety check: ensure we got an ID
      if (!newList?.id) {
        const errorMsg = "List creation did not return an id";
        if (import.meta.env.DEV) {
            if (import.meta.env.DEV) {
              console.error(errorMsg, newList);
            }
        }
        setError("Failed to create list. Please try again.");
        setCreating(false);
        return;
      }

      // Step 2: Immediately add the place to the new list using the returned ID
      const { error: upsertError } = await supabase
        .from("list_places")
        .upsert(
          {
            list_id: newList.id,
            place_id: place.id,
          },
          {
            onConflict: "list_id,place_id",
            ignoreDuplicates: true,
          }
        );

      if (upsertError) {
        if (import.meta.env.DEV) {
          console.error("Error adding place to new list:", upsertError);
        }
        setError("List created but couldn't add place. Please try adding it manually.");
        setCreating(false);
        return;
      }

      // PostHog: Track list creation
      try {
        import("posthog-js").then(({ default: posthog }) => {
          posthog.capture("list_created", {
            list_id: newList.id,
            visibility: newListVisibility,
          });
        });
      } catch (e) {
        // Silently ignore PostHog errors
      }

      // Step 3: Reload lists to get full list data (including slug, created_at, etc.)
      const { data: updatedLists, error: reloadError } = await supabase
        .from("lists")
        .select("id, name, visibility, slug, created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (!reloadError && updatedLists) {
        setLists(updatedLists);
      } else {
        // If reload fails, at least add the new list to state with minimal data
        setLists([
          {
            id: newList.id,
            name: newListName.trim(),
            visibility: newListVisibility,
            slug: "", // Will be populated on next full reload
            created_at: new Date().toISOString(),
          },
          ...lists,
        ]);
      }

      // Update selected list ID
      setSelectedListId(newList.id);
      setShowCreateForm(false);
      setNewListName("");
      setSuccess(true);
      setCreating(false);

      // Close modal after a brief delay to show success message
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Unexpected error creating list and adding place:", err);
      }
      setError("An unexpected error occurred");
      setCreating(false);
    }
  };

  // Handle add to list
  const handleAddToList = async () => {
    if (!user || !selectedListId) {
      setError("Please select a list");
      return;
    }

    setAdding(true);
    setError(null);

    try {
      // Use upsert with ignoreDuplicates to avoid duplicates
      const { error: upsertError } = await supabase
        .from("list_places")
        .upsert(
          {
            list_id: selectedListId,
            place_id: place.id,
          },
          {
            onConflict: "list_id,place_id",
            ignoreDuplicates: true,
          }
        );

      if (upsertError) {
        // Log in dev only
        if (import.meta.env.DEV) {
          console.error("Error adding to list:", upsertError);
        }
        setError("Couldn't add to list");
        setAdding(false);
        return;
      }

      setSuccess(true);
      setAdding(false);

      // Close modal after a brief delay to show success message
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Unexpected error adding to list:", err);
      }
      setError("An unexpected error occurred");
      setAdding(false);
    }
  };

  if (!isOpen) return null;

  // If user is not authenticated, don't show modal
  if (!user) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onClose();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Close modal"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="w-full max-w-md rounded-lg border border-surface/60 bg-surface/30 p-6 shadow-neon-md"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text">Add to List</h2>
          <button
            onClick={onClose}
            className="text-text/60 transition-colors hover:text-text"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-text/70">
          Add <span className="font-medium text-text">{place.name}</span> to a list
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent">
            Added to list!
          </div>
        )}

        {!showCreateForm ? (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
              </div>
            ) : lists.length === 0 ? (
              <div className="mb-4 rounded-lg border border-surface/60 bg-bg/40 p-4 text-center">
                <p className="mb-4 text-sm text-text/60">No lists yet. Create one!</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="rounded-lg border border-accent/60 bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20"
                >
                  Create List
                </button>
              </div>
            ) : (
              <div className="mb-4">
                <label htmlFor="list-select" className="mb-2 block text-sm font-medium text-text/80">
                  Select List
                </label>
                <select
                  id="list-select"
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full rounded-lg border border-surface/60 bg-bg px-4 py-2 text-text focus:border-accent focus:outline-none"
                >
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.visibility === "public" ? "Public" : "Private"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleAddToList}
                disabled={adding || !selectedListId || lists.length === 0}
                className="flex-1 rounded-lg border border-accent/60 bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20 disabled:opacity-50"
              >
                {adding ? "Adding..." : "Add to List"}
              </button>
              <button
                onClick={() => setShowCreateForm(true)}
                className="rounded-lg border border-surface/60 bg-surface/30 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface/50"
              >
                New List
              </button>
              <button
                onClick={onClose}
                className="rounded-lg border border-surface/60 bg-surface/30 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface/50"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="new-list-name" className="mb-2 block text-sm font-medium text-text/80">
                List Name *
              </label>
              <input
                id="new-list-name"
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="w-full rounded-lg border border-surface/60 bg-bg px-4 py-2 text-text focus:border-accent focus:outline-none"
                placeholder="e.g., Date Night Spots"
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="new-list-visibility" className="mb-2 block text-sm font-medium text-text/80">
                Visibility
              </label>
              <select
                id="new-list-visibility"
                value={newListVisibility}
                onChange={(e) => setNewListVisibility(e.target.value as "private" | "public")}
                className="w-full rounded-lg border border-surface/60 bg-bg px-4 py-2 text-text focus:border-accent focus:outline-none"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleCreateList}
                disabled={creating || !newListName.trim()}
                className="flex-1 rounded-lg border border-accent/60 bg-accent/15 px-4 py-2 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create & Add"}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setNewListName("");
                }}
                className="rounded-lg border border-surface/60 bg-surface/30 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface/50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
