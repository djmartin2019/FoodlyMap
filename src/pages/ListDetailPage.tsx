import { Link,useParams } from "@tanstack/react-router";
import { useEffect, useMemo,useState } from "react";

import AddSavedPlaceToListModal from "../components/AddSavedPlaceToListModal";
import ListPlacesTable, { ListPlaceRow } from "../components/ListPlacesTable";
import { RequireAuth } from "../components/RequireAuth";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface Place {
  id: string;
  name: string;
  display_address: string | null;
  address_line1: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
}

interface ListPlace {
  id: string;
  place_id: string;
  note: string | null;
  sort_order: number | null;
  added_at: string;
  places: Place;
}

interface List {
  id: string;
  name: string;
  description: string | null;
  visibility: "private" | "public";
  slug: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export default function ListDetailPage() {
  const params = useParams({ strict: false });
  const listId = (params as { listId?: string }).listId;
  const { user } = useAuth();
  const [list, setList] = useState<List | null>(null);
  const [listPlaces, setListPlaces] = useState<ListPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [inFeed, setInFeed] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);

  // Load list
  useEffect(() => {
    if (!listId || !user) return;

    const loadList = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("lists")
          .select("id, name, description, visibility, slug, owner_id, created_at, updated_at")
          .eq("id", listId)
          .maybeSingle();

        if (fetchError || !data) {
          if (import.meta.env.DEV) {
            console.error("Error loading list:", fetchError);
          }
          setError("not_found");
          setLoading(false);
          return;
        }

        setList(data);
        setIsOwner(data.owner_id === user.id);

        // Check if list is in feed (only for owners of public lists)
        if (data.owner_id === user.id && data.visibility === "public") {
          const { data: feedData } = await supabase
            .from("feed_posts")
            .select("id")
            .eq("list_id", data.id)
            .maybeSingle();
          setInFeed(!!feedData);
        }

        // Load list places
        const { data: placesData, error: placesError } = await supabase
          .from("list_places")
          .select(
            "id, place_id, note, sort_order, added_at, places(id, name, display_address, address_line1, city, region, postal_code, country)"
          )
          .eq("list_id", listId)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("added_at", { ascending: true });

        if (placesError) {
          if (import.meta.env.DEV) {
            console.error("Error loading list places:", placesError);
          }
          setListPlaces([]);
        } else {
          setListPlaces((placesData || []) as unknown as ListPlace[]);
        }

        setLoading(false);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error("Unexpected error loading list:", err);
        }
        setError("not_found");
        setLoading(false);
      }
    };

    loadList();
  }, [listId, user]);

  // Transform list places to table rows
  const tableRows = useMemo<ListPlaceRow[]>(() => {
    return listPlaces
      .filter((lp) => {
        // Defensive check: ensure lp exists, has places, and places has required fields
        // This prevents crashes when joined rows are null (e.g., place was deleted but list_places still references it)
        if (!lp || !lp.places) return false;
        const place = lp.places;
        return (
          typeof place === 'object' &&
          !Array.isArray(place) &&
          typeof place.id === 'string' &&
          typeof place.name === 'string'
        );
      })
      .map((lp) => {
        const place = lp.places;
        const addressParts = [
          place.address_line1,
          place.city,
          place.region,
        ].filter(Boolean);
        const address = addressParts.length > 0 
          ? addressParts.join(", ") 
          : place.display_address || "Address not available";

        return {
          list_place_id: lp.id,
          place_id: lp.place_id,
          name: place.name,
          address,
          note: lp.note,
          added_at: lp.added_at,
          sort_order: lp.sort_order,
        };
      });
  }, [listPlaces]);

  // Handle remove place from list
  const handleRemove = async (listPlaceId: string) => {
    if (!isOwner || !confirm("Remove this place from the list?")) {
      return;
    }

    setRemovingId(listPlaceId);

    try {
      const { error: deleteError } = await supabase
        .from("list_places")
        .delete()
        .eq("id", listPlaceId);

      if (deleteError) {
        if (import.meta.env.DEV) {
          console.error("Error removing place:", deleteError);
        }
        setError("Couldn't remove place");
        setRemovingId(null);
        return;
      }

      // Optimistically remove from state
      setListPlaces(listPlaces.filter((lp) => lp.id !== listPlaceId));
      setRemovingId(null);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Unexpected error removing place:", err);
      }
      setError("An unexpected error occurred");
      setRemovingId(null);
    }
  };

  // Handle successful add
  const handleAddSuccess = async () => {
    // Refetch list places
    if (!listId) return;

    const { data, error: placesError } = await supabase
      .from("list_places")
      .select(
        "id, place_id, note, sort_order, added_at, places(id, name, display_address, address_line1, city, region, postal_code, country)"
      )
      .eq("list_id", listId)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("added_at", { ascending: true });

    if (!placesError && data) {
      setListPlaces(data as unknown as ListPlace[]);
    }
  };

  // Handle add to feed
  const handleAddToFeed = async () => {
    if (!list || !isOwner || list.visibility !== "public") return;

    setFeedLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from("feed_posts")
        .insert([{ list_id: list.id }]);

      if (insertError) {
        if (import.meta.env.DEV) {
          console.error("Error adding to feed:", insertError);
        }
        setError("Failed to add to feed. Please try again.");
        setFeedLoading(false);
        return;
      }

      setInFeed(true);
      setFeedLoading(false);

      // PostHog: Track feed add
      try {
        import("posthog-js").then(({ default: posthog }) => {
          posthog.capture("list_added_to_feed", {
            list_id: list.id,
            slug: list.slug,
          });
        });
      } catch (e) {
        // Silently ignore PostHog errors
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Unexpected error adding to feed:", err);
      }
      setError("An unexpected error occurred");
      setFeedLoading(false);
    }
  };

  // Handle remove from feed
  const handleRemoveFromFeed = async () => {
    if (!list || !isOwner) return;

    setFeedLoading(true);
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from("feed_posts")
        .delete()
        .eq("list_id", list.id);

      if (deleteError) {
        if (import.meta.env.DEV) {
          console.error("Error removing from feed:", deleteError);
        }
        setError("Failed to remove from feed. Please try again.");
        setFeedLoading(false);
        return;
      }

      setInFeed(false);
      setFeedLoading(false);

      // PostHog: Track feed remove
      try {
        import("posthog-js").then(({ default: posthog }) => {
          posthog.capture("list_removed_from_feed", {
            list_id: list.id,
            slug: list.slug,
          });
        });
      } catch (e) {
        // Silently ignore PostHog errors
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Unexpected error removing from feed:", err);
      }
      setError("An unexpected error occurred");
      setFeedLoading(false);
    }
  };

  if (loading) {
    return (
      <RequireAuth>
        <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-12">
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
          </div>
        </div>
      </RequireAuth>
    );
  }

  if (error === "not_found" || !list) {
    return (
      <RequireAuth>
        <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-12">
          <div className="rounded-2xl border border-surface/60 bg-surface/30 p-8 text-center md:p-12">
            <h1 className="mb-4 text-3xl font-bold text-text md:text-4xl">List Not Found</h1>
            <p className="mb-6 text-text/70">The list you're looking for doesn't exist.</p>
            <Link
              to="/lists"
              className="inline-block rounded-lg border border-accent/60 bg-accent/15 px-6 py-3 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20"
            >
              Back to My Lists
            </Link>
          </div>
        </div>
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-12">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="mb-4 flex items-center gap-4">
            <Link
              to="/lists"
              className="text-sm text-text/60 transition-colors hover:text-accent"
            >
              ← Back to Lists
            </Link>
          </div>
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent sm:text-4xl md:text-5xl">
            {list.name}
          </h1>
          {list.description && (
            <p className="text-base text-text/70 sm:text-sm">{list.description}</p>
          )}
          <div className="mt-2 flex items-center gap-4">
            <span
              className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                list.visibility === "public"
                  ? "bg-accent/20 text-accent"
                  : "bg-surface/60 text-text/60"
              }`}
            >
              {list.visibility === "public" ? "Public" : "Private"}
            </span>
            {list.visibility === "public" && (
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/l/${list.slug}`;
                  try {
                    await navigator.clipboard.writeText(url);
                    alert("Public link copied to clipboard!");
                    
                    // PostHog: Track share click
                    try {
                      import("posthog-js").then(({ default: posthog }) => {
                        posthog.capture("list_share_clicked", {
                          list_id: list.id,
                          slug: list.slug,
                          visibility: list.visibility,
                        });
                      });
                    } catch (e) {
                      // Silently ignore PostHog errors
                    }
                  } catch (err) {
                    if (import.meta.env.DEV) {
                      console.error("Failed to copy link:", err);
                    }
                  }
                }}
                className="text-sm text-accent/70 transition-colors hover:text-accent"
              >
                Copy Public Link
              </button>
            )}
          </div>
        </div>

        {error && error !== "not_found" && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Owner actions */}
        {isOwner && (
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-lg border border-accent/60 bg-accent/15 px-6 py-3 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20"
            >
              Edit Places
            </button>
            {list.visibility === "public" && (
              <button
                onClick={inFeed ? handleRemoveFromFeed : handleAddToFeed}
                disabled={feedLoading}
                className="rounded-lg border border-accent/60 bg-accent/15 px-6 py-3 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20 disabled:opacity-50"
              >
                {feedLoading
                  ? "Loading..."
                  : inFeed
                    ? "Remove from Feed"
                    : "Add to Feed"}
              </button>
            )}
          </div>
        )}

        {/* Not owner message */}
        {!isOwner && (
          <div className="mb-6 rounded-lg border border-surface/60 bg-surface/30 p-4">
            <p className="text-sm text-text/70">
              You can view this list, but only the owner can manage it.
            </p>
            {list.visibility === "public" && (
              <Link
                to="/l/$slug"
                params={{ slug: list.slug }}
                className="mt-2 inline-block text-sm text-accent/70 transition-colors hover:text-accent"
              >
                View public page →
              </Link>
            )}
          </div>
        )}

        {/* List places table */}
        <ListPlacesTable
          rows={tableRows}
          loading={loading}
          isOwner={isOwner}
          onRemove={handleRemove}
          removingId={removingId}
        />

        {/* Edit Places Modal */}
        {showAddModal && listId && list && (
          <AddSavedPlaceToListModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            listId={listId}
            listName={list.name}
            onSaved={handleAddSuccess}
          />
        )}
      </div>
    </RequireAuth>
  );
}
