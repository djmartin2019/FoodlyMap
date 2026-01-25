import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import DashboardMap, { MapMode, Place } from "../components/DashboardMap";
import PlaceNameForm from "../components/PlaceNameForm";

export default function UserDashboardPage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<MapMode>("VIEW");
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCoordinates, setPendingCoordinates] = useState<{ lng: number; lat: number } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user's places on mount
  useEffect(() => {
    const loadPlaces = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch places linked to this user via user_places junction table
        const { data, error: fetchError } = await supabase
          .from("user_places")
          .select(`
            place:places (
              id,
              name,
              latitude,
              longitude
            )
          `)
          .eq("user_id", user.id);

        if (fetchError) {
          console.error("Error fetching places:", fetchError);
          setError("Failed to load places");
          setLoading(false);
          return;
        }

        // Transform the data to match Place interface
        const userPlaces: Place[] = (data || [])
          .map((item: any) => item.place)
          .filter((place: any) => place !== null)
          .map((place: any) => ({
            id: place.id,
            name: place.name,
            latitude: place.latitude,
            longitude: place.longitude,
          }));

        setPlaces(userPlaces);
        setLoading(false);
      } catch (err) {
        console.error("Unexpected error loading places:", err);
        setError("An unexpected error occurred");
        setLoading(false);
      }
    };

    loadPlaces();
  }, [user]);

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

  // Handle form submission - save place
  const handleSavePlace = async (name: string) => {
    if (!user || !pendingCoordinates) {
      setError("Missing user or coordinates");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Insert place into places table
      const { data: placeData, error: placeError } = await supabase
        .from("places")
        .insert([
          {
            name,
            latitude: pendingCoordinates.lat,
            longitude: pendingCoordinates.lng,
          },
        ])
        .select()
        .single();

      if (placeError) {
        console.error("Error creating place:", placeError);
        setError("Failed to save place. Please try again.");
        setSaving(false);
        return;
      }

      // Link place to user via user_places junction table
      const { error: linkError } = await supabase
        .from("user_places")
        .insert([
          {
            user_id: user.id,
            place_id: placeData.id,
          },
        ]);

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

      setPlaces([...places, newPlace]);
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
    // Stay in ADD_PLACE mode so user can try again
    // Keep pendingCoordinates so they can click "Place Here" again
  };

  return (
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

      {/* Map Section - Mobile: Reduced padding, better spacing for iOS Safari */}
      <div className="rounded-2xl border border-surface/60 bg-surface/30 p-4 shadow-neon-sm sm:p-6 md:p-8">
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
              />
              {/* Show form overlay when user clicks "Place Here" */}
              {showForm && pendingCoordinates && mode === "ADD_PLACE" && (
                <PlaceNameForm
                  onSubmit={handleSavePlace}
                  onCancel={handleFormCancel}
                  loading={saving}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
