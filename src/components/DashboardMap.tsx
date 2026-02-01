import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { buildPlacePopupNode } from "../lib/safeDom";
import { log } from "../lib/log";

export type MapMode = "VIEW" | "ADD_PLACE";

export interface Place {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  display_address?: string | null;
  category_name?: string | null;
}

interface UserLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  timestamp?: number;
}

interface DashboardMapProps {
  mode: MapMode;
  onMapCenterChange?: (lng: number, lat: number) => void;
  places?: Place[];
  hideTempMarker?: boolean; // Hide temporary marker when form is shown
  highlightedLocationId?: string | null; // ID of location to highlight
  centerOnLocation?: { lat: number; lng: number }; // Coordinates to center map on
  userLocation?: UserLocation | null; // User's current location (client-side only)
  centerOnUserLocation?: boolean; // Flag to center map on user location
  onAddToList?: (place: Place) => void; // Callback when "Add to List" is clicked from popup
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
export default function DashboardMap({ 
  mode, 
  onMapCenterChange, 
  places = [], 
  hideTempMarker = false,
  highlightedLocationId = null,
  centerOnLocation,
  userLocation = null,
  centerOnUserLocation = false,
  onAddToList,
}: DashboardMapProps) {
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
  // Ref to highlighted marker (for view-on-map feature)
  const highlightedMarkerRef = useRef<mapboxgl.Marker | null>(null);
  // Ref to user location marker ("You are here")
  const userLocationMarkerRef = useRef<mapboxgl.Marker | null>(null);

  // Initialize map exactly once
  useEffect(() => {
    // Guard: map already initialized - skip if map exists
    if (mapRef.current) return;
    // Guard: container not yet mounted - skip if container doesn't exist
    if (!mapContainerRef.current) return;

    // Get Mapbox access token from environment variable
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      log.warn("VITE_MAPBOX_TOKEN not found in environment variables");
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
      highlightedMarkerRef.current?.remove();
      highlightedMarkerRef.current = null;
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;
      
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
      // Get current center without changing map state
      const center = map.getCenter();
      const currentZoom = map.getZoom();
      
      // Ensure map doesn't zoom out - maintain current zoom level
      // This prevents the map from resetting when entering ADD_PLACE mode
      if (currentZoom < 10) {
        map.setZoom(11); // Minimum reasonable zoom for adding places
      }
      
      // Remove existing temporary marker if it exists
      tempMarkerRef.current?.remove();
      
      // Create temporary marker with two-layer structure to prevent drift
      // Outer wrapper: passed to Mapbox - MUST be minimal, Mapbox applies position/transform
      const outerEl = document.createElement("div");
      outerEl.style.width = "20px";
      outerEl.style.height = "20px";
      outerEl.style.display = "block";
      // Prevent transitions that could interfere with Mapbox's transform updates
      outerEl.style.transition = "none";
      // NO position, transform, or willChange - Mapbox controls these
      // Mapbox will apply position: absolute and transform: translate() itself
      
      // Inner element: all visual styling, fills outer element naturally
      const innerEl = document.createElement("div");
      innerEl.className = "temp-place-marker";
      innerEl.style.width = "100%";
      innerEl.style.height = "100%";
      innerEl.style.borderRadius = "50%";
      innerEl.style.backgroundColor = "#39FF88";
      innerEl.style.border = "3px solid rgba(57, 255, 136, 0.8)";
      innerEl.style.boxShadow = "0 0 12px rgba(57, 255, 136, 0.6)";
      innerEl.style.cursor = "default";
      // No position styles - just fills the outer element naturally
      innerEl.style.zIndex = "100"; // Lower z-index so form can appear above
      
      outerEl.appendChild(innerEl);
      
      // Create temporary marker at map center
      // anchor: "center" ensures the marker is centered on the lat/lng point
      tempMarkerRef.current = new mapboxgl.Marker({ 
        element: outerEl,
        anchor: "center"
      })
        .setLngLat([center.lng, center.lat])
        .addTo(map);

      // Update marker position visually during move (no state update)
      const updateMarkerPosition = () => {
        if (tempMarkerRef.current && mode === "ADD_PLACE" && !hideTempMarker) {
          const newCenter = map.getCenter();
          tempMarkerRef.current.setLngLat([newCenter.lng, newCenter.lat]);
        }
      };

      // Update parent state only when movement ends (to avoid excessive re-renders)
      // Don't call on initial mount - only on actual map movement
      const updateParentState = () => {
        if (mode === "ADD_PLACE" && !hideTempMarker && onMapCenterChange) {
          const newCenter = map.getCenter();
          onMapCenterChange(newCenter.lng, newCenter.lat);
        }
      };

      // Listen to map move events to keep marker visually centered (smooth updates)
      map.on("move", updateMarkerPosition);
      // Only update parent state when movement ends (prevents excessive re-renders)
      map.on("moveend", updateParentState);

      // Store cleanup function
      const cleanup = () => {
        map.off("move", updateMarkerPosition);
        map.off("moveend", updateParentState);
      };

      return cleanup;
    } else {
      // VIEW mode: Remove temporary marker
      tempMarkerRef.current?.remove();
      tempMarkerRef.current = null;
    }
  }, [mode, onMapCenterChange, hideTempMarker]);

  // Render existing places as markers
  // Keep markers visible in ADD_PLACE mode for better UX
  useEffect(() => {
    if (!mapRef.current) {
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
        const isHighlighted = highlightedLocationId === place.id;
        
        // Create marker with two-layer structure to prevent drift
        // Outer wrapper: passed to Mapbox - MUST be minimal, Mapbox applies position/transform
        const outerEl = document.createElement("div");
        const markerSize = isHighlighted ? "18px" : "12px";
        outerEl.style.width = markerSize;
        outerEl.style.height = markerSize;
        outerEl.style.display = "block";
        // Prevent transitions that could interfere with Mapbox's transform updates
        outerEl.style.transition = "none";
        // NO position, transform, or willChange - Mapbox controls these
        // Mapbox will apply position: absolute and transform: translate() itself
        
        // Inner element: all visual styling, fills outer element naturally
        const innerEl = document.createElement("div");
        innerEl.className = "place-marker";
        innerEl.style.width = "100%";
        innerEl.style.height = "100%";
        innerEl.style.borderRadius = "50%";
        innerEl.style.backgroundColor = "#39FF88";
        if (isHighlighted) {
          innerEl.style.border = "3px solid rgba(57, 255, 136, 1)";
          innerEl.style.boxShadow = "0 0 16px rgba(57, 255, 136, 0.8)";
        } else {
          innerEl.style.border = "2px solid rgba(57, 255, 136, 0.6)";
          innerEl.style.boxShadow = "0 0 8px rgba(57, 255, 136, 0.5)";
        }
        // In ADD_PLACE mode, make existing markers non-interactive to prevent accidental clicks
        // The temp marker should be the focus, not existing places
        if (mode === "ADD_PLACE") {
          innerEl.style.cursor = "default";
          innerEl.style.pointerEvents = "none";
        } else {
          innerEl.style.cursor = "pointer";
          innerEl.style.pointerEvents = "auto";
        }
        // No position styles - just fills the outer element naturally
        innerEl.style.zIndex = isHighlighted ? "2000" : "1000";
        
        outerEl.appendChild(innerEl);

        // Create popup with safe DOM construction (prevents XSS)
        // All user-provided text is set via textContent, not innerHTML
        const popupContentNode = buildPlacePopupNode(
          {
            id: place.id,
            name: place.name,
            display_address: place.display_address,
            category_name: place.category_name,
          },
          onAddToList ? () => onAddToList(place) : undefined
        );

        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: true,
          className: "place-popup",
          offset: isHighlighted ? 30 : 25, // Offset popup above marker
        })
          .setDOMContent(popupContentNode);

        // Create marker with anchor center for proper positioning
        const marker = new mapboxgl.Marker({ 
          element: outerEl,
          anchor: "center"
        })
          .setLngLat([place.longitude, place.latitude])
          .addTo(map);
        
        // Only attach popup in VIEW mode (not ADD_PLACE) to prevent interaction during place addition
        if (mode !== "ADD_PLACE") {
          marker.setPopup(popup);
          // Note: "Add to List" button click handler is already attached in buildPlacePopupNode()
        }

        if (isHighlighted) {
          highlightedMarkerRef.current = marker;
          // Open popup for highlighted location (only in VIEW mode)
          if (mode !== "ADD_PLACE") {
            popup.addTo(map);
          }
        }

        placeMarkersRef.current.push(marker);
        placePopupsRef.current.push(popup);
      });
    }
  }, [places, mode, highlightedLocationId, onAddToList]);

  // Handle centering map on location from URL params
  // Use ref to track previous coordinates to prevent repeated flyTo calls
  const prevCenterRef = useRef<{ lat: number; lng: number } | null>(null);
  
  useEffect(() => {
    if (!mapRef.current || !centerOnLocation) {
      prevCenterRef.current = null;
      return;
    }

    // Don't flyTo during ADD_PLACE mode - it interferes with user interaction
    if (mode === "ADD_PLACE") {
      return;
    }

    // Only flyTo if coordinates actually changed
    const prevCenter = prevCenterRef.current;
    if (
      prevCenter &&
      prevCenter.lat === centerOnLocation.lat &&
      prevCenter.lng === centerOnLocation.lng
    ) {
      return; // Coordinates haven't changed, skip flyTo
    }

    const map = mapRef.current;
    prevCenterRef.current = { lat: centerOnLocation.lat, lng: centerOnLocation.lng };
    
    map.flyTo({
      center: [centerOnLocation.lng, centerOnLocation.lat],
      zoom: 14,
      duration: 1000,
    });
  }, [centerOnLocation, mode]);

  // Handle user location marker and centering
  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;

    // Wait for map to load before adding user location marker
    if (!map.loaded()) {
      map.once("load", () => {
        renderUserLocation();
      });
    } else {
      renderUserLocation();
    }

    function renderUserLocation() {
      // Remove existing user location marker
      userLocationMarkerRef.current?.remove();
      userLocationMarkerRef.current = null;

      if (!userLocation) {
        return;
      }

      // Create user location marker with distinct styling ("You are here")
      const outerEl = document.createElement("div");
      outerEl.style.width = "16px";
      outerEl.style.height = "16px";
      outerEl.style.display = "block";
      outerEl.style.transition = "none";

      const innerEl = document.createElement("div");
      innerEl.className = "user-location-marker";
      innerEl.style.width = "100%";
      innerEl.style.height = "100%";
      innerEl.style.borderRadius = "50%";
      innerEl.style.backgroundColor = "#3B82F6"; // Blue color to distinguish from place markers
      innerEl.style.border = "3px solid rgba(59, 130, 246, 0.8)";
      innerEl.style.boxShadow = "0 0 12px rgba(59, 130, 246, 0.6)";
      innerEl.style.cursor = "default";
      innerEl.style.zIndex = "1500"; // Higher than place markers

      outerEl.appendChild(innerEl);

      // Create marker
      userLocationMarkerRef.current = new mapboxgl.Marker({
        element: outerEl,
        anchor: "center",
      })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map);

      // Add popup with "You are here" text (using safe DOM construction)
      const userLocationContainer = document.createElement("div");
      userLocationContainer.style.display = "flex";
      userLocationContainer.style.flexDirection = "column";
      userLocationContainer.style.gap = "4px";

      const titleEl = document.createElement("div");
      titleEl.style.fontSize = "14px";
      titleEl.style.fontWeight = "600";
      titleEl.style.color = "#3B82F6";
      titleEl.textContent = "You are here";
      userLocationContainer.appendChild(titleEl);

      if (userLocation.accuracy) {
        const accuracyEl = document.createElement("div");
        accuracyEl.style.fontSize = "11px";
        accuracyEl.style.color = "rgba(233, 255, 242, 0.6)";
        accuracyEl.textContent = `Accuracy: ${Math.round(userLocation.accuracy)}m`;
        userLocationContainer.appendChild(accuracyEl);
      }

      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: true,
        className: "user-location-popup",
        offset: 25,
      })
        .setDOMContent(userLocationContainer);

      userLocationMarkerRef.current.setPopup(popup);
    }
  }, [userLocation]);

  // Handle centering map on user location (separate effect to avoid re-rendering marker)
  useEffect(() => {
    if (!mapRef.current || !centerOnUserLocation || !userLocation) return;

    const map = mapRef.current;
    const currentZoom = map.getZoom();
    const targetZoom = currentZoom < 14 ? 14 : Math.min(currentZoom, 16);

    map.flyTo({
      center: [userLocation.lng, userLocation.lat],
      zoom: targetZoom,
      duration: 1000,
    });
  }, [centerOnUserLocation, userLocation]);

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
