import { Link, useNavigate,useParams } from "@tanstack/react-router";
import { useEffect, useMemo,useState } from "react";

import ListPlacesTable, { ListPlaceRow } from "../components/ListPlacesTable";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";

interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  display_address: string | null;
  address_line1: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  mapbox_place_id: string | null;
  verified: boolean;
}

interface ListPlace {
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
  visibility: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  slug: string;
}

export default function PublicListPage() {
  // Get slug from route params
  const params = useParams({ strict: false });
  const slug = (params as { slug?: string }).slug;
  const { user } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState<List | null>(null);
  const [listPlaces, setListPlaces] = useState<ListPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load list by slug
  useEffect(() => {
    const loadList = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from("lists")
          .select("id, name, description, visibility, owner_id, created_at, updated_at, slug")
          .eq("slug", slug)
          .maybeSingle();

        // Handle errors - never reveal if list exists but is private
        if (fetchError || !data) {
          setError("not_found");
          setLoading(false);
          return;
        }

        // Check visibility - RLS should handle this, but double-check for UX
        if (data.visibility !== "public") {
          setError("not_found");
          setLoading(false);
          return;
        }

        setList(data);

        // PostHog: Track public list view
        try {
          import("posthog-js").then(({ default: posthog }) => {
            posthog.capture("public_list_viewed", {
              slug: data.slug,
              is_owner: user?.id === data.owner_id,
            });
          });
        } catch (e) {
          // Silently ignore PostHog errors
        }

        // Load list places with joined place data
        const { data: placesData, error: placesError } = await supabase
          .from("list_places")
          .select(
            "place_id, note, sort_order, added_at, places(id, name, latitude, longitude, display_address, address_line1, city, region, postal_code, country, mapbox_place_id, verified)"
          )
          .eq("list_id", data.id)
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
        // Log in dev only
        if (import.meta.env.DEV) {
          console.error("Unexpected error loading list:", err);
        }
        setError("not_found");
        setLoading(false);
      }
    };

    if (slug) {
      loadList();
    }
  }, [slug]);

  // Transform list places to table rows
  const tableRows = useMemo<ListPlaceRow[]>(() => {
    if (!listPlaces || listPlaces.length === 0) {
      return [];
    }
    
    try {
      return listPlaces
        .filter((lp) => {
          // Defensive check: ensure lp exists and has places
          if (!lp) return false;
          // Supabase returns places as an object (not array) when using join syntax
          const places = lp.places;
          if (!places || typeof places !== 'object' || Array.isArray(places)) {
            return false;
          }
          // Type guard: ensure it has a name property
          return 'name' in places && typeof (places as any).name === 'string';
        })
        .map((lp) => {
          const place = lp.places as Place;
          
          const addressParts = [
            place.address_line1,
            place.city,
            place.region,
          ].filter(Boolean);
          const address = addressParts.length > 0 
            ? addressParts.join(", ") 
            : place.display_address || "Address not available";

          return {
            list_place_id: lp.place_id, // Use place_id as fallback since PublicListPage doesn't have list_places.id
            place_id: lp.place_id,
            name: place.name,
            address,
            note: lp.note,
            added_at: lp.added_at,
            sort_order: lp.sort_order,
            verified: place.verified || false,
          };
        });
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Error transforming list places to table rows:", error);
        console.error("listPlaces data:", listPlaces);
      }
      return [];
    }
  }, [listPlaces]);

  // Handle "Save to my map"
  const handleSaveToMap = async () => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }

    if (!list || listPlaces.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      // Get all place IDs from the list
      const placeIds = listPlaces.map((lp) => lp.place_id);

      // Check which places the user already has
      const { data: existingPlaces, error: checkError } = await supabase
        .from("user_places")
        .select("place_id")
        .eq("user_id", user.id)
        .in("place_id", placeIds);

      if (checkError) {
        if (import.meta.env.DEV) {
          console.error("Error checking existing places:", checkError);
        }
        setError("Failed to save places. Please try again.");
        setSaving(false);
        return;
      }

      const existingPlaceIds = new Set((existingPlaces || []).map((ep) => ep.place_id));
      const newPlaceIds = placeIds.filter((id) => !existingPlaceIds.has(id));

      if (newPlaceIds.length === 0) {
        setError("All places from this list are already in your map.");
        setSaving(false);
        return;
      }

      // Insert new user_places entries
      const userPlacesToInsert = newPlaceIds.map((placeId) => ({
        user_id: user.id,
        place_id: placeId,
      }));

      const { error: insertError } = await supabase
        .from("user_places")
        .insert(userPlacesToInsert);

      if (insertError) {
        if (import.meta.env.DEV) {
          console.error("Error saving places:", insertError);
        }
        setError("Failed to save places. Please try again.");
        setSaving(false);
        return;
      }

      // Success - navigate to dashboard
      navigate({ to: "/dashboard" });
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error("Unexpected error saving places:", err);
      }
      setError("An unexpected error occurred");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-12 md:px-8 md:py-20">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
        </div>
      </div>
    );
  }

  if (error === "not_found" || !list) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-12 md:px-8 md:py-20">
        <div className="rounded-2xl border border-surface/60 bg-surface/30 p-8 text-center md:p-12">
          <h1 className="mb-4 text-3xl font-bold text-text md:text-4xl">List Not Found</h1>
          <p className="mb-6 text-text/70">
            The list you're looking for doesn't exist or is not publicly available.
          </p>
          <Link
            to="/"
            className="inline-block rounded-lg border border-accent/60 bg-accent/15 px-6 py-3 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col px-6 py-12 md:px-8 md:py-20">
      <article className="rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm md:p-12">
        {/* Header */}
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
            {list.name}
          </h1>
          {list.description && (
            <p className="text-lg text-text/80">{list.description}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="mb-6 flex flex-wrap gap-3">
          {/* Owner actions */}
          {user && list.owner_id === user.id && (
            <Link
              to="/lists/$listId"
              params={{ listId: list.id }}
              className="rounded-lg border border-accent/60 bg-accent/15 px-6 py-3 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20"
            >
              View this list in your dashboard
            </Link>
          )}

          {/* Save to Map Button */}
          {user ? (
            <button
              onClick={handleSaveToMap}
              disabled={saving || listPlaces.length === 0}
              className="rounded-lg border border-accent/60 bg-accent/15 px-6 py-3 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save places to my map"}
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-lg border border-accent/60 bg-accent/15 px-6 py-3 text-sm font-medium text-accent transition-colors hover:border-accent hover:bg-accent/20"
            >
              Log in to save this list
            </Link>
          )}
        </div>

        {error && error !== "not_found" && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Places List */}
        {loading ? (
          <div className="rounded-xl border border-surface/60 bg-surface/30 p-8">
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
            </div>
          </div>
        ) : (
          <ListPlacesTable
            rows={tableRows}
            loading={false}
            isOwner={false}
          />
        )}
      </article>
    </div>
  );
}
