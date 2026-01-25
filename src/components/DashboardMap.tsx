import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";

export type MapMode = "VIEW" | "ADD_PLACE";

export interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface DashboardMapProps {
  mode: MapMode;
  onMapCenterChange?: (lng: number, lat: number) => void;
  places?: Place[];
  hideTempMarker?: boolean; // Hide temporary marker when form is shown
}

/**
 * DashboardMap Component
 * 
 * Renders a Mapbox map for authenticated users with support for two modes:
 * - VIEW: Shows existing places, allows interaction with pins
 * - ADD_PLACE: Shows temporary center-locked marker, disables existing pins
 * 
 * Lifecycle Management:
 * - Uses useRef to prevent re-initialization on React re-renders
 * - Map is created exactly once in useEffect
 * - Properly cleaned up on unmount to prevent memory leaks
 * 
 * The useRef guard is critical because:
 * 1. Mapbox maps are imperative objects, not React state
 * 2. React re-renders (from state updates, parent re-renders, etc.) would otherwise
 *    trigger multiple map initializations
 * 3. Multiple map instances cause performance issues and memory leaks
 */
export default function DashboardMap({ mode, onMapCenterChange, places = [], hideTempMarker = false }: DashboardMapProps) {
  // Ref to the container div - React will attach this to the DOM element
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  // Ref to the map instance - prevents re-initialization on re-renders
  // This is the critical guard: if mapRef.current exists, we skip initialization
  const mapRef = useRef<mapboxgl.Map | null>(null);
  // Ref to temporary marker (for ADD_PLACE mode)
  const tempMarkerRef = useRef<mapboxgl.Marker | null>(null);
  // Ref to existing place markers
  const placeMarkersRef = useRef<mapboxgl.Marker[]>([]);
  // Ref to existing place popups
  const placePopupsRef = useRef<mapboxgl.Popup[]>([]);

  // Initialize map exactly once
  useEffect(() => {
    // Guard: map already initialized - skip if map exists
    if (mapRef.current) return;
    // Guard: container not yet mounted - skip if container doesn't exist
    if (!mapContainerRef.current) return;

    // Get Mapbox access token from environment variable
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      console.warn("VITE_MAPBOX_TOKEN not found in environment variables");
      return;
    }

    // Set Mapbox access token
    mapboxgl.accessToken = token;

    // Create map exactly once - lifecycle managed by refs, not React state
    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11", // Dark style as requested
      center: [-95.3698, 29.7604], // Houston, TX coordinates
      zoom: 11, // Reasonable default zoom level
      attributionControl: false, // Hide attribution for cleaner UI
    });

    // Cleanup function: destroy map instance on unmount
    return () => {
      // Remove all markers
      placeMarkersRef.current.forEach((marker) => marker.remove());
      placeMarkersRef.current = [];
      placePopupsRef.current.forEach((popup) => popup.remove());
      placePopupsRef.current = [];
      tempMarkerRef.current?.remove();
      tempMarkerRef.current = null;
      
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Handle map mode changes and temporary marker
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Hide marker if hideTempMarker is true (form is showing)
    if (hideTempMarker) {
      tempMarkerRef.current?.remove();
      return;
    }

    if (mode === "ADD_PLACE") {
      // ADD_PLACE mode: Create temporary center-locked marker
      // This marker is not draggable - it stays at map center
      const center = map.getCenter();
      
      // Remove existing temporary marker if it exists
      tempMarkerRef.current?.remove();
      
      // Create temporary marker element (ghost style)
      const el = document.createElement("div");
      el.className = "temp-place-marker";
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#39FF88";
      el.style.border = "3px solid rgba(57, 255, 136, 0.8)";
      el.style.boxShadow = "0 0 12px rgba(57, 255, 136, 0.6)";
      el.style.cursor = "default";
      el.style.position = "relative";
      el.style.zIndex = "100"; // Lower z-index so form can appear above
      
      // Create temporary marker at map center
      tempMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([center.lng, center.lat])
        .addTo(map);

      // Update temporary marker position when map moves
      const updateTempMarker = () => {
        if (tempMarkerRef.current && mode === "ADD_PLACE" && !hideTempMarker) {
          const newCenter = map.getCenter();
          tempMarkerRef.current.setLngLat([newCenter.lng, newCenter.lat]);
          // Notify parent of center change
          if (onMapCenterChange) {
            onMapCenterChange(newCenter.lng, newCenter.lat);
          }
        }
      };

      // Listen to map move events to keep marker centered
      map.on("move", updateTempMarker);
      map.on("moveend", updateTempMarker);

      // Store cleanup function
      const cleanup = () => {
        map.off("move", updateTempMarker);
        map.off("moveend", updateTempMarker);
      };

      return cleanup;
    } else {
      // VIEW mode: Remove temporary marker
      tempMarkerRef.current?.remove();
      tempMarkerRef.current = null;
    }
  }, [mode, onMapCenterChange, hideTempMarker]);

  // Render existing places as markers
  useEffect(() => {
    if (!mapRef.current || mode === "ADD_PLACE") {
      // Don't render existing places in ADD_PLACE mode
      // Clear existing markers if switching to ADD_PLACE
      if (mode === "ADD_PLACE") {
        placeMarkersRef.current.forEach((marker) => marker.remove());
        placeMarkersRef.current = [];
        placePopupsRef.current.forEach((popup) => popup.remove());
        placePopupsRef.current = [];
      }
      return;
    }

    const map = mapRef.current;

    // Wait for map to load before adding markers
    if (!map.loaded()) {
      map.once("load", () => {
        renderPlaces();
      });
    } else {
      renderPlaces();
    }

    function renderPlaces() {
      // Remove existing markers
      placeMarkersRef.current.forEach((marker) => marker.remove());
      placeMarkersRef.current = [];
      placePopupsRef.current.forEach((popup) => popup.remove());
      placePopupsRef.current = [];

      // Create markers for each place
      places.forEach((place) => {
        // Create marker element
        const el = document.createElement("div");
        el.className = "place-marker";
        el.style.width = "12px";
        el.style.height = "12px";
        el.style.borderRadius = "50%";
        el.style.backgroundColor = "#39FF88";
        el.style.border = "2px solid rgba(57, 255, 136, 0.6)";
        el.style.boxShadow = "0 0 8px rgba(57, 255, 136, 0.5)";
        el.style.cursor = "pointer";
        el.style.pointerEvents = "auto";
        el.style.position = "relative";
        el.style.zIndex = "1000";

        // Create popup with proper styling
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: true,
          className: "place-popup",
          offset: 25, // Offset popup above marker
        })
          .setHTML(`<div class="text-sm font-semibold text-text">${place.name}</div>`);

        // Create marker and attach popup directly
        // This makes the popup show automatically on marker click
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([place.longitude, place.latitude])
          .setPopup(popup) // Attach popup to marker
          .addTo(map);

        placeMarkersRef.current.push(marker);
        placePopupsRef.current.push(popup);
      });
    }
  }, [places, mode]);

  return (
    <div className="relative h-full w-full">
      {/* Map container - full width and height */}
      <div
        ref={mapContainerRef}
        className="h-full w-full"
        role="application"
        aria-label={mode === "ADD_PLACE" ? "Add place mode - pan map to position marker" : "Interactive food map"}
      />
      {/* Fallback message if token is missing */}
      {!import.meta.env.VITE_MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg/80">
          <p className="text-sm text-text/60">
            Add VITE_MAPBOX_TOKEN to your .env file to see the map
          </p>
        </div>
      )}
    </div>
  );
}
