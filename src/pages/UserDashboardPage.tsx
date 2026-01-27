import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useSearch } from "@tanstack/react-router";
import DashboardMap, { MapMode, Place } from "../components/DashboardMap";
import PlaceNameForm from "../components/PlaceNameForm";
import LocationsTable, { Location } from "../components/LocationsTable";
import { RequireAuth } from "../components/RequireAuth";

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
        console.error("Error fetching categories:", fetchError);
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
      console.error("Unexpected error loading categories:", err);
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
            created_at
          ),
          category:categories (
            id,
            name
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching places:", fetchError);
        if (setLoadingState) {
          setError("Failed to load places");
          setLoading(false);
        }
        return;
      }

      // Transform the data for both Place interface (map) and Location interface (table)
      // category_id is now on user_places, not places
      const userLocations: Location[] = (data || [])
        .filter((item: any) => item.place !== null)
        .map((item: any) => ({
          id: item.place.id,
          name: item.place.name,
          latitude: item.place.latitude,
          longitude: item.place.longitude,
          category_id: item.category_id || null,
          category_name: item.category?.name || null,
          created_at: item.created_at,
        }));

      // Also create Place array for map component
      const userPlaces: Place[] = userLocations.map((loc) => ({
        id: loc.id,
        name: loc.name,
        latitude: loc.latitude,
        longitude: loc.longitude,
      }));

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
      console.error("Unexpected error loading places:", err);
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
  const handleMapCenterChange = (lng: number, lat: number) => {
    if (mode === "ADD_PLACE") {
      setPendingCoordinates({ lng, lat });
    }
  };

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

  // Handle form submission - save place
  const handleSavePlace = async (name: string, categoryId: string | null) => {
    if (!user || !pendingCoordinates) {
      setError("Missing user or coordinates");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Insert place into places table (no category_id - it's on user_places now)
      const placeDataToInsert = {
        name,
        latitude: pendingCoordinates.lat,
        longitude: pendingCoordinates.lng,
      };

      const { data: placeData, error: placeError } = await supabase
        .from("places")
        .insert([placeDataToInsert])
        .select()
        .single();

      if (placeError) {
        console.error("Error creating place:", placeError);
        setError("Failed to save place. Please try again.");
        setSaving(false);
        return;
      }

      // Link place to user via user_places junction table
      // category_id is now stored on user_places, not places
      const userPlaceData: {
        user_id: string;
        place_id: string;
        category_id?: string | null;
      } = {
        user_id: user.id,
        place_id: placeData.id,
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
        console.error("Error linking place to user:", linkError);
        setError("Failed to link place to your account. Please try again.");
        setSaving(false);
        return;
      }

      // Success: Add new place to local state
      const newPlace: Place = {
        id: placeData.id,
        name: placeData.name,
        latitude: placeData.latitude,
        longitude: placeData.longitude,
      };

      const newLocation: Location = {
        id: placeData.id,
        name: placeData.name,
        latitude: placeData.latitude,
        longitude: placeData.longitude,
        category_id: categoryId && categoryId.trim() !== "" ? categoryId : null,
        category_name: categoryId 
          ? categories.find(c => c.id === categoryId)?.name || null
          : null,
        created_at: placeData.created_at,
      };

      setPlaces([...places, newPlace]);
      setLocations([newLocation, ...locations]);
      
      // Invalidate cache
      if (user) {
        try {
          localStorage.removeItem(`foodly_locations_${user.id}`);
        } catch (e) {
          // Ignore cache errors
        }
      }
      
      setMode("VIEW");
      setPendingCoordinates(null);
      setShowForm(false);
      setSaving(false);
    } catch (err) {
      console.error("Unexpected error saving place:", err);
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
        console.error("User does not have access to this place:", checkError);
        throw new Error("You do not have permission to update this location");
      }

      // Update the place name (places table)
      const placeUpdateData = { name };
      const { error: placeUpdateError } = await supabase
        .from("places")
        .update(placeUpdateData)
        .eq("id", locationId);

      if (placeUpdateError) {
        console.error("Error updating place name:", placeUpdateError);
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
        console.error("Error updating user_places category:", userPlaceUpdateError);
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
        console.error("Error refetching locations after update:", err);
        // If refetch fails, we still have the optimistic update
      });
    } catch (err) {
      console.error("Unexpected error updating location:", err);
      throw err;
    }
  };

  // Handle delete location
  const handleDeleteLocation = async (locationId: string) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      // Delete from user_places junction table (this removes the link, not the place itself)
      const { error: deleteError } = await supabase
        .from("user_places")
        .delete()
        .eq("user_id", user.id)
        .eq("place_id", locationId);

      if (deleteError) {
        console.error("Error deleting user_places link:", deleteError);
        throw new Error("Failed to delete location");
      }

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
        console.error("Error refetching locations after delete:", err);
        // If refetch fails, we still have the optimistic update
      });
    } catch (err) {
      console.error("Unexpected error deleting location:", err);
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
            <button
              onClick={handleAddPlace}
              className="w-full rounded-lg border border-accent/60 bg-accent/15 px-6 py-3 text-base font-medium text-accent transition-colors active:bg-accent/20 sm:w-auto sm:py-2 sm:text-sm hover:border-accent hover:bg-accent/20"
            >
              Add Place
            </button>
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

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
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
              />
              {/* Show form overlay when user clicks "Place Here" */}
              {showForm && pendingCoordinates && mode === "ADD_PLACE" && (
                <PlaceNameForm
                  onSubmit={handleSavePlace}
                  onCancel={handleFormCancel}
                  loading={saving}
                  categories={categories}
                  onCategoryCreated={handleCategoryCreated}
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
    </RequireAuth>
  );
}
