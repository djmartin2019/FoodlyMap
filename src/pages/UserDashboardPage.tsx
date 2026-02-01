import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useSearch } from "@tanstack/react-router";
import DashboardMap, { MapMode, Place } from "../components/DashboardMap";
import PlaceNameForm, { GeocodedAddress } from "../components/PlaceNameForm";
import LocationsTable, { Location } from "../components/LocationsTable";
import { RequireAuth } from "../components/RequireAuth";
import AddToListModal from "../components/AddToListModal";
import { createOrGetPlace } from "../lib/places";
import { log } from "../lib/log";

interface Category {
  id: string;
  name: string;
}

export default function UserDashboardPage() {
  const { user } = useAuth();
  const search = useSearch({ strict: false }) as { locationId?: string; lat?: number; lng?: number } | undefined;
  const [mode, setMode] = useState<MapMode>("VIEW");
  const [viewMode, setViewMode] = useState<"map" | "table">("map"); // Mobile toggle: map or table
  const [places, setPlaces] = useState<Place[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCoordinates, setPendingCoordinates] = useState<{ lng: number; lat: number } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedLocationId, setHighlightedLocationId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number; accuracy?: number; timestamp?: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [centerOnUserLocation, setCenterOnUserLocation] = useState(false);
  const [addingToListPlace, setAddingToListPlace] = useState<Place | null>(null);

  // Load categories when user becomes available
  // Memoized to prevent unnecessary re-fetches
  const loadCategories = useCallback(async () => {
    if (!user) {
      setCategories([]);
      return;
    }

    try {
      // Try cache first
      const cacheKey = `foodly_categories_${user.id}`;
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const cacheTime = parsed.timestamp || 0;
          const now = Date.now();
          // Use cache if less than 5 minutes old
          if (now - cacheTime < 5 * 60 * 1000) {
            setCategories(parsed.categories || []);
            // Still fetch fresh data in background
          }
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }

      const { data, error: fetchError } = await supabase
        .from("categories")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name");

      if (fetchError) {
        log.error("Error fetching categories:", fetchError);
        return;
      }

      const categoriesData = data || [];
      setCategories(categoriesData);
      
      // Cache the data
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          categories: categoriesData,
          timestamp: Date.now(),
        }));
      } catch (e) {
        // localStorage might be full or disabled, ignore
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        log.error("Unexpected error loading categories:", err);
      }
    }
  }, [user]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Refactored loadLocations to be reusable
  // setLoadingState: if true, will set loading state (for initial load), if false, won't (for background refresh)
  // Memoized with useCallback to prevent unnecessary re-renders and ensure stable reference
  const loadLocations = useCallback(async (setLoadingState: boolean = false) => {
    if (!user) {
      if (setLoadingState) setLoading(false);
      return;
    }

    if (setLoadingState) setLoading(true);

    try {
      // Try to load from cache first for faster initial render
      const cacheKey = `foodly_locations_${user.id}`;
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData && setLoadingState) {
        try {
          const parsed = JSON.parse(cachedData);
          const cacheTime = parsed.timestamp || 0;
          const now = Date.now();
          // Use cache if less than 5 minutes old
          if (now - cacheTime < 5 * 60 * 1000) {
            setLocations(parsed.locations || []);
            setPlaces(parsed.places || []);
            setLoading(false);
            // Still fetch fresh data in background
          }
        } catch (e) {
          // Invalid cache, continue to fetch
        }
      }

      // Fetch places linked to this user via user_places junction table
      // category_id is now on user_places, not places
      // Also fetch category name if category_id exists
      const { data, error: fetchError } = await supabase
        .from("user_places")
        .select(`
          id,
          category_id,
          created_at,
          place:places (
            id,
            name,
            latitude,
            longitude,
            created_at,
            display_address
          ),
          category:categories (
            id,
            name
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        if (import.meta.env.DEV) {
          log.error("Error fetching places:", fetchError);
        }
        if (setLoadingState) {
          setError("Failed to load places");
          setLoading(false);
        }
        return;
      }

      // Transform the data for both Place interface (map) and Location interface (table)
      // category_id is now on user_places, not places
      // Defensive filtering: ensure place exists and has required fields before mapping
      // This prevents crashes when joined rows are null (e.g., place was deleted but user_places still references it)
      // Deduplicate by place.id to prevent duplicate keys in React
      const locationMap = new Map<string, Location>();
      (data || [])
        .filter((item: any) => {
          // Ensure item exists, has place, and place has required fields
          if (!item || !item.place) return false;
          const place = item.place;
          return (
            typeof place === 'object' &&
            !Array.isArray(place) &&
            typeof place.id === 'string' &&
            typeof place.name === 'string' &&
            typeof place.latitude === 'number' &&
            typeof place.longitude === 'number'
          );
        })
        .forEach((item: any) => {
          const placeId = item.place.id;
          // Only add if we haven't seen this place_id before, or use the most recent one
          if (!locationMap.has(placeId)) {
            locationMap.set(placeId, {
              id: item.place.id,
              name: item.place.name,
              latitude: item.place.latitude,
              longitude: item.place.longitude,
              category_id: item.category_id || null,
              category_name: (item.category && typeof item.category === 'object' && !Array.isArray(item.category) && item.category.name) ? item.category.name : null,
              created_at: item.created_at || new Date().toISOString(),
            });
          }
        });
      const userLocations: Location[] = Array.from(locationMap.values());

      // Also create Place array for map component (include address and category for popup)
      // Defensive filtering: ensure place exists and has required fields before mapping
      // Deduplicate by place.id to prevent duplicate keys in React
      const placeMap = new Map<string, Place>();
      (data || [])
        .filter((item: any) => {
          // Ensure item exists, has place, and place has required fields
          if (!item || !item.place) return false;
          const place = item.place;
          return (
            typeof place === 'object' &&
            !Array.isArray(place) &&
            typeof place.id === 'string' &&
            typeof place.name === 'string' &&
            typeof place.latitude === 'number' &&
            typeof place.longitude === 'number'
          );
        })
        .forEach((item: any) => {
          const placeId = item.place.id;
          // Only add if we haven't seen this place_id before
          if (!placeMap.has(placeId)) {
            placeMap.set(placeId, {
              id: item.place.id,
              name: item.place.name,
              latitude: item.place.latitude,
              longitude: item.place.longitude,
              display_address: item.place.display_address || null,
              category_name: (item.category && typeof item.category === 'object' && !Array.isArray(item.category) && item.category.name) ? item.category.name : null,
            });
          }
        });
      const userPlaces: Place[] = Array.from(placeMap.values());

      setLocations(userLocations);
      setPlaces(userPlaces);
      
      // Cache the data for faster reloads
      try {
        localStorage.setItem(cacheKey, JSON.stringify({
          locations: userLocations,
          places: userPlaces,
          timestamp: Date.now(),
        }));
      } catch (e) {
        // localStorage might be full or disabled, ignore
      }
      
      if (setLoadingState) setLoading(false);
    } catch (err) {
      log.error("Unexpected error loading places:", err);
      if (setLoadingState) {
        setError("An unexpected error occurred");
        setLoading(false);
      }
    }
  }, [user]);

  // Load user's locations (places) when user becomes available
  useEffect(() => {
    if (user) {
      loadLocations(true); // Set loading state for initial load
    } else {
      // Clear data if user logs out
      setLocations([]);
      setPlaces([]);
      setLoading(false);
    }
  }, [user, loadLocations]);

  // Memoize centerOnLocation to prevent flyTo from retriggering on every render
  // Only create object if we have valid coordinates
  const centerOnLocation = useMemo(() => {
    if (search?.lat && search?.lng) {
      return { lat: search.lat, lng: search.lng };
    }
    return undefined;
  }, [search?.lat, search?.lng]);

  // Handle URL search params for view-on-map
  useEffect(() => {
    if (search?.locationId && search.lat && search.lng) {
      setHighlightedLocationId(search.locationId);
      // Center map will be handled by DashboardMap component
      // Clear highlight after 3 seconds
      const timer = setTimeout(() => {
        setHighlightedLocationId(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [search]);

  // Handle entering ADD_PLACE mode
  const handleAddPlace = () => {
    setMode("ADD_PLACE");
    setError(null);
  };

  // Handle canceling ADD_PLACE mode
  const handleCancel = () => {
    setMode("VIEW");
    setPendingCoordinates(null);
    setShowForm(false);
    setError(null);
  };

  // Handle map center change in ADD_PLACE mode
  // Memoized to prevent infinite loops in DashboardMap useEffect
  const handleMapCenterChange = useCallback((lng: number, lat: number) => {
    if (mode === "ADD_PLACE") {
      setPendingCoordinates({ lng, lat });
    }
  }, [mode]);

  // Handle "Place Here" click - show form
  const handlePlaceHere = () => {
    if (pendingCoordinates) {
      setShowForm(true);
    }
  };

  // Handle category creation
  const handleCategoryCreated = (category: Category) => {
    // Add new category to local state
    setCategories((prev) => [...prev, category].sort((a, b) => a.name.localeCompare(b.name)));
    
    // Invalidate category cache
    if (user) {
      try {
        localStorage.removeItem(`foodly_categories_${user.id}`);
      } catch (e) {
        // Ignore cache errors
      }
    }
  };

  // Handle form submission - save place with proper deduplication
  const handleSavePlace = async (
    name: string,
    categoryId: string | null,
    geocodedAddress: GeocodedAddress | null
  ) => {
    if (!user || !pendingCoordinates) {
      setError("Missing user or coordinates");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Step 0: Check if user already has this place saved (by mapbox_place_id)
      // If they do, skip mapbox_place_id deduplication to allow creating a new pin at a different location
      let shouldSkipMapboxDedupe = false;
      if (geocodedAddress?.mapbox_place_id) {
        const { data: existingUserPlaces } = await supabase
          .from("user_places")
          .select("place_id, place:places(mapbox_place_id)")
          .eq("user_id", user.id);

        if (existingUserPlaces) {
          // Check if any of the user's places have this mapbox_place_id
          const hasThisPlace = existingUserPlaces.some((up: any) => {
            const place = up.place;
            return place && typeof place === 'object' && !Array.isArray(place) && 
                   place.mapbox_place_id === geocodedAddress.mapbox_place_id;
          });

          if (hasThisPlace) {
            shouldSkipMapboxDedupe = true;
          }
        }
      }

      // Step 1: Create or get existing place using helper function
      // If user already has this place, pass null for mapbox_place_id to skip that dedupe path
      const placeData = await createOrGetPlace({
        name,
        latitude: pendingCoordinates.lat,
        longitude: pendingCoordinates.lng,
        display_address: geocodedAddress?.display_address ?? null,
        address_line1: geocodedAddress?.address_line1 ?? null,
        city: geocodedAddress?.city ?? null,
        region: geocodedAddress?.region ?? null,
        postal_code: geocodedAddress?.postal_code ?? null,
        country: geocodedAddress?.country ?? null,
        // Skip mapbox_place_id dedupe if user already has this place saved
        mapbox_place_id: shouldSkipMapboxDedupe ? null : (geocodedAddress?.mapbox_place_id ?? null),
        geocoded_at: geocodedAddress?.mapbox_place_id ? new Date().toISOString() : null,
        created_by: user.id,
      });

      const placeId = placeData.id;

      // Step 2: Link place to user via user_places
      // Check if user_places link already exists (prevent duplicates)
      const { data: existingUserPlace, error: checkError } = await supabase
        .from("user_places")
        .select("id")
        .eq("user_id", user.id)
        .eq("place_id", placeId)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") {
        if (import.meta.env.DEV) {
          log.error("Error checking user_places:", checkError);
        }
        setError("Failed to save place. Please try again.");
        setSaving(false);
        return;
      }

      // Only insert into user_places if it doesn't already exist
      if (!existingUserPlace) {
        const userPlaceData: {
          user_id: string;
          place_id: string;
          category_id?: string | null;
        } = {
          user_id: user.id,
          place_id: placeId,
        };
        
        // Only include category_id if it has a value
        if (categoryId && categoryId.trim() !== "") {
          userPlaceData.category_id = categoryId;
        } else {
          userPlaceData.category_id = null;
        }

        const { error: linkError } = await supabase
          .from("user_places")
          .insert([userPlaceData]);

        if (linkError) {
          // Handle duplicate user_places gracefully (user might have already saved this place)
          if (linkError.code === "23505" || linkError.message?.includes("unique")) {
            // Already exists - that's fine, continue
          } else {
            if (import.meta.env.DEV) {
              log.error("Error linking place to user:", linkError);
            }
            setError("Failed to link place to your account. Please try again.");
            setSaving(false);
            return;
          }
        }
      }

      // PostHog: Track place creation
      try {
        import("posthog-js").then(({ default: posthog }) => {
          posthog.capture("place_created", {
            place_id: placeData.id,
            has_address: !!(geocodedAddress?.display_address),
            has_category: !!categoryId,
          });
        });
      } catch (e) {
        // Silently ignore PostHog errors
      }

      // Success: Add new place to local state
      // Use the clicked coordinates for the pin display, not the existing place's coordinates
      // This ensures the pin appears where the user clicked, even if we reused an existing place
      const newPlace: Place = {
        id: placeData.id,
        name: placeData.name,
        latitude: pendingCoordinates.lat,
        longitude: pendingCoordinates.lng,
        display_address: placeData.display_address || null,
        category_name: categoryId 
          ? categories.find(c => c.id === categoryId)?.name || null
          : null,
      };

      const newLocation: Location = {
        id: placeData.id,
        name: placeData.name,
        latitude: pendingCoordinates.lat,
        longitude: pendingCoordinates.lng,
        category_id: categoryId && categoryId.trim() !== "" ? categoryId : null,
        category_name: categoryId 
          ? categories.find(c => c.id === categoryId)?.name || null
          : null,
        created_at: placeData.created_at || new Date().toISOString(),
      };

      // Update local state with the new pin at the clicked location
      // If the place already exists in local state, update its coordinates to the clicked location
      // This ensures the pin appears where the user clicked, even if they already have this place saved
      setPlaces(prevPlaces => {
        const existingIndex = prevPlaces.findIndex(p => p.id === newPlace.id);
        if (existingIndex >= 0) {
          // Update existing place with new coordinates
          const updated = [...prevPlaces];
          updated[existingIndex] = newPlace;
          return updated;
        }
        // Add new place
        return [...prevPlaces, newPlace];
      });
      setLocations(prevLocations => {
        const existingIndex = prevLocations.findIndex(loc => loc.id === newLocation.id);
        if (existingIndex >= 0) {
          // Update existing location with new coordinates
          const updated = [...prevLocations];
          updated[existingIndex] = newLocation;
          return updated;
        }
        // Add new location at the beginning
        return [newLocation, ...prevLocations];
      });
      
      // Invalidate cache
      if (user) {
        try {
          localStorage.removeItem(`foodly_locations_${user.id}`);
        } catch (e) {
          // Ignore cache errors
        }
      }
      
      // Reset all form/map state after successful save
      // This ensures the next "Add Place" starts fresh and doesn't reuse old coordinates
      // Fixes bug where re-added place would copy last location
      setMode("VIEW");
      setPendingCoordinates(null);
      setShowForm(false);
      setSaving(false);
      setError(null);
    } catch (err) {
      if (import.meta.env.DEV) {
        log.error("Unexpected error saving place:", err);
      }
      setError("An unexpected error occurred. Please try again.");
      setSaving(false);
    }
  };

  // Handle form cancel
  const handleFormCancel = () => {
    setShowForm(false);
    setMode("VIEW");
    setPendingCoordinates(null);
    // Exit ADD_PLACE mode to restore normal marker view
  };

  // Handle update location
  const handleUpdateLocation = async (locationId: string, name: string, categoryId: string | null) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      // First, verify the user has access to this place via user_places
      const { data: userPlaceCheck, error: checkError } = await supabase
        .from("user_places")
        .select("id, place_id")
        .eq("user_id", user.id)
        .eq("place_id", locationId)
        .single();
      
      if (checkError || !userPlaceCheck) {
        if (import.meta.env.DEV) {
          log.error("User does not have access to this place:", checkError);
        }
        throw new Error("You do not have permission to update this location");
      }

      // Update the place name (places table)
      const placeUpdateData = { name };
      const { error: placeUpdateError } = await supabase
        .from("places")
        .update(placeUpdateData)
        .eq("id", locationId);

      if (placeUpdateError) {
        if (import.meta.env.DEV) {
          log.error("Error updating place name:", placeUpdateError);
        }
        throw new Error(placeUpdateError.message || "Failed to update place name");
      }

      // Update category_id on user_places (not places)
      // Normalize categoryId: empty string or null becomes null
      const categoryIdToSet = (categoryId && categoryId.trim() !== "") ? categoryId.trim() : null;
      
      // Build update data - always include category_id (even if null) to ensure it's set
      const userPlaceUpdateData: { category_id: string | null } = {
        category_id: categoryIdToSet,
      };

      // Update using user_id and place_id together (more reliable with RLS)
      // This ensures RLS policies that check user_id will allow the update
      const { data: updatedUserPlaces, error: userPlaceUpdateError } = await supabase
        .from("user_places")
        .update(userPlaceUpdateData)
        .eq("user_id", user.id)
        .eq("place_id", locationId)
        .select();

      if (userPlaceUpdateError) {
        if (import.meta.env.DEV) {
          log.error("Error updating user_places category:", userPlaceUpdateError);
        }
        throw new Error(userPlaceUpdateError.message || "Failed to update category");
      }

      if (!updatedUserPlaces || updatedUserPlaces.length === 0) {
        throw new Error("Update did not affect any rows. Check RLS policies on user_places table.");
      }

      // Optimistically update local state
      setLocations(prevLocations => 
        prevLocations.map(loc => 
          loc.id === locationId 
            ? { 
                ...loc, 
                name, 
                category_id: categoryId,
                category_name: categoryId 
                  ? categories.find(c => c.id === categoryId)?.name || null
                  : null
              }
            : loc
        )
      );
      
      setPlaces(prevPlaces =>
        prevPlaces.map(place =>
          place.id === locationId
            ? { ...place, name }
            : place
        )
      );

      // Invalidate cache
      if (user) {
        try {
          localStorage.removeItem(`foodly_locations_${user.id}`);
        } catch (e) {
          // Ignore cache errors
        }
      }

      // Refetch in background to ensure consistency (don't await, don't set loading state)
      loadLocations(false).catch(err => {
        if (import.meta.env.DEV) {
          log.error("Error refetching locations after update:", err);
        }
        // If refetch fails, we still have the optimistic update
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        log.error("Unexpected error updating location:", err);
      }
      throw err;
    }
  };

  // Handle "Center on me" / get current location
  const handleCenterOnMe = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    setLocationLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const newLocation = {
          lat: latitude,
          lng: longitude,
          accuracy,
          timestamp: Date.now(),
        };
        setUserLocation(newLocation);
        setCenterOnUserLocation(true);
        setLocationLoading(false);
        // Reset center flag after a short delay to allow re-centering if clicked again
        setTimeout(() => setCenterOnUserLocation(false), 100);
      },
      (error) => {
        setLocationLoading(false);
        let errorMessage = "Location unavailable";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Enable location in your browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
          default:
            errorMessage = "Unable to get your location.";
            break;
        }
        
        setLocationError(errorMessage);
        // Clear error after 5 seconds
        setTimeout(() => setLocationError(null), 5000);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  };

  // Handle delete location
  // IMPORTANT: This function deletes ONLY the user's relationship to a place (user_places row),
  // NOT the global place itself. This ensures:
  // 1. Other users who have saved the same place are not affected
  // 2. Lists that reference this place continue to work
  // 3. The place can be re-added by the same or different users later
  // 
  // If the place has no remaining references (no user_places or list_places rows),
  // it should be cleaned up by a database function or scheduled job, not by client code.
  // Client code only has anon key and should not delete global places directly.
  const handleDeleteLocation = async (locationId: string) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      // Delete from user_places junction table (this removes the link, not the place itself)
      // This is safe because RLS ensures users can only delete their own user_places rows
      const { error: deleteError } = await supabase
        .from("user_places")
        .delete()
        .eq("user_id", user.id)
        .eq("place_id", locationId);

      if (deleteError) {
        if (import.meta.env.DEV) {
          log.error("Error deleting user_places link:", deleteError);
        }
        throw new Error("Failed to delete location");
      }

      // Reset form/map state after successful delete
      setMode("VIEW");
      setPendingCoordinates(null);
      setShowForm(false);
      setHighlightedLocationId(null);

      // Optimistically update UI
      setLocations(locations.filter(loc => loc.id !== locationId));
      setPlaces(places.filter(place => place.id !== locationId));

      // Invalidate cache
      if (user) {
        try {
          localStorage.removeItem(`foodly_locations_${user.id}`);
        } catch (e) {
          // Ignore cache errors
        }
      }

      // Refetch in background to ensure consistency (don't await, don't set loading state)
      loadLocations(false).catch(err => {
        if (import.meta.env.DEV) {
          log.error("Error refetching locations after delete:", err);
        }
        // If refetch fails, we still have the optimistic update
      });
    } catch (err) {
      if (import.meta.env.DEV) {
        log.error("Unexpected error deleting location:", err);
      }
      // Revert optimistic update on error
      await loadLocations();
      throw err;
    }
  };

  return (
    <RequireAuth>
      <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-12">
      {/* Header - Mobile: Increased spacing for better vertical rhythm on iOS Safari */}
      <div className="mb-6 sm:mb-8">
        <h1 className="mb-3 text-3xl font-bold tracking-tight text-accent sm:mb-2 sm:text-4xl md:text-5xl">
          Your Food Map
        </h1>
        <p className="text-base text-text/70 sm:text-sm">
          Explore and manage your personal food collection on the map.
        </p>
      </div>

      {/* Mobile: View Toggle (Map View / Table View) */}
      <div className="mb-4 flex gap-2 sm:hidden">
        <button
          onClick={() => setViewMode("map")}
          className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            viewMode === "map"
              ? "border-accent/60 bg-accent/15 text-accent"
              : "border-surface/60 bg-surface/30 text-text/70"
          }`}
        >
          Map View
        </button>
        <button
          onClick={() => setViewMode("table")}
          className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            viewMode === "table"
              ? "border-accent/60 bg-accent/15 text-accent"
              : "border-surface/60 bg-surface/30 text-text/70"
          }`}
        >
          Table View
        </button>
      </div>

      {/* Map Section - Mobile: Reduced padding, better spacing for iOS Safari */}
      {/* Mobile: Only show if viewMode is "map", Desktop: Always show */}
      <div className={`rounded-2xl border border-surface/60 bg-surface/30 p-4 shadow-neon-sm sm:p-6 md:p-8 ${viewMode === "table" ? "hidden sm:block" : ""}`}>
        {/* Mobile: Stack header and buttons vertically on small screens for better touch targets */}
        <div className="mb-4 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-accent sm:text-2xl">Map View</h2>
            <p className="mt-2 text-sm text-text/80 sm:mt-1 sm:text-base">
              {mode === "ADD_PLACE" 
                ? "Pan the map to position your new place, then tap 'Place Here'" 
                : "Pin places you've been, organize them into lists, and discover new spots through friends."}
            </p>
          </div>
          {/* Mobile: Full-width buttons for easier tapping on iOS Safari */}
          {mode === "VIEW" && (
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:gap-2">
              <button
                onClick={handleCenterOnMe}
                disabled={locationLoading}
                className="w-full rounded-lg border border-surface/60 bg-surface/30 px-6 py-3 text-base font-medium text-text transition-colors active:bg-surface/50 disabled:opacity-50 sm:w-auto sm:py-2 sm:text-sm hover:border-accent/60 hover:bg-surface/50"
                title="Uses browser location. Not saved."
              >
                {locationLoading ? "Locating..." : "Center on me"}
              </button>
              <button
                onClick={handleAddPlace}
                className="w-full rounded-lg border border-accent/60 bg-accent/15 px-6 py-3 text-base font-medium text-accent transition-colors active:bg-accent/20 sm:w-auto sm:py-2 sm:text-sm hover:border-accent hover:bg-accent/20"
              >
                Add Place
              </button>
            </div>
          )}
          {mode === "ADD_PLACE" && (
            <div className="flex gap-3 sm:flex-row">
              <button
                onClick={handleCancel}
                className="flex-1 rounded-lg border border-surface/60 bg-surface/30 px-6 py-3 text-base font-medium text-text transition-colors active:bg-surface/50 sm:flex-none sm:py-2 sm:text-sm hover:border-accent/60 hover:bg-surface/50"
              >
                Cancel
              </button>
              <button
                onClick={handlePlaceHere}
                disabled={!pendingCoordinates}
                className="flex-1 rounded-lg border border-accent/60 bg-accent/15 px-6 py-3 text-base font-medium text-accent transition-colors active:bg-accent/20 disabled:opacity-50 sm:flex-none sm:py-2 sm:text-sm hover:border-accent hover:bg-accent/20"
              >
                Place Here
              </button>
            </div>
          )}
        </div>

        {/* Error messages */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}
        {locationError && (
          <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
            {locationError}
          </div>
        )}

        {/* Map container - Mobile: Responsive height using viewport units that respect iOS Safari dynamic viewport */}
        {/* Mobile: Uses 50vh with 400px minimum to ensure map is visible even with Safari UI chrome */}
        {/* Tablet: 500px, Desktop: 600px - fixed heights for stability on larger screens */}
        <div className="relative w-full overflow-hidden rounded-lg border-2 border-accent/20 bg-bg/40 shadow-inner h-[50vh] min-h-[400px] sm:h-[500px] md:h-[600px]">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
            </div>
          ) : (
            <>
              <DashboardMap
                mode={mode}
                onMapCenterChange={handleMapCenterChange}
                places={places}
                hideTempMarker={showForm}
                highlightedLocationId={highlightedLocationId}
                centerOnLocation={centerOnLocation}
                userLocation={userLocation}
                centerOnUserLocation={centerOnUserLocation}
                onAddToList={(place) => setAddingToListPlace(place)}
              />
              {/* Show form overlay when user clicks "Place Here" */}
              {showForm && pendingCoordinates && mode === "ADD_PLACE" && (
                <PlaceNameForm
                  onSubmit={handleSavePlace}
                  onCancel={handleFormCancel}
                  loading={saving}
                  categories={categories}
                  onCategoryCreated={handleCategoryCreated}
                  coordinates={pendingCoordinates ? { lat: pendingCoordinates.lat, lng: pendingCoordinates.lng } : null}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Table View Section */}
      {/* Mobile: Only show if viewMode is "table", Desktop: Always show below map */}
      <div className={`mt-6 ${viewMode === "map" ? "hidden sm:block" : ""}`}>
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-accent sm:text-2xl">Your Locations</h2>
          <p className="mt-1 text-sm text-text/80 sm:text-base">
            View and manage all your saved places.
          </p>
        </div>
        <LocationsTable 
          locations={locations} 
          categories={categories} 
          loading={loading}
          onUpdate={handleUpdateLocation}
          onDelete={handleDeleteLocation}
          onCategoryCreated={handleCategoryCreated}
          onViewOnMap={() => setViewMode("map")}
        />
      </div>
      </div>

      {/* Add to List Modal */}
      {addingToListPlace && (
        <AddToListModal
          isOpen={!!addingToListPlace}
          onClose={() => setAddingToListPlace(null)}
          place={{
            id: addingToListPlace.id,
            name: addingToListPlace.name,
          }}
        />
      )}
    </RequireAuth>
  );
}
