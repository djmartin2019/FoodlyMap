/**
 * Mapbox reverse geocoding utility
 * 
 * Fetches address information from Mapbox Geocoding API based on lat/lng coordinates.
 * Selects the best feature based on distance and type (prefers address features).
 */

import { log } from "./log";

export interface ReverseGeocodeResult {
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

interface MapboxFeature {
  id: string;
  place_name: string;
  text: string;
  address?: string;
  place_type?: string[];
  center?: [number, number]; // [longitude, latitude]
  geometry?: {
    coordinates: [number, number]; // [longitude, latitude]
    type: string;
  };
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
}

interface MapboxResponse {
  features: MapboxFeature[];
}

// In-memory cache keyed by rounded coordinates
const geocodeCache = new Map<string, ReverseGeocodeResult | null>();

// Round coordinates to 5 decimals for cache key (approximately 1 meter precision)
function getCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

// Check if token is available (only log warning once)
let tokenWarningLogged = false;

/**
 * Calculate distance between two points in meters using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Check if a feature is an address type
 */
function isAddressFeature(feature: MapboxFeature): boolean {
  return feature.place_type?.includes("address") ?? false;
}

/**
 * Get feature center coordinates
 */
function getFeatureCenter(feature: MapboxFeature): { lat: number; lng: number } | null {
  // Prefer center property, fall back to geometry.coordinates
  if (feature.center) {
    return { lng: feature.center[0], lat: feature.center[1] };
  }
  if (feature.geometry?.coordinates) {
    return { lng: feature.geometry.coordinates[0], lat: feature.geometry.coordinates[1] };
  }
  return null;
}

/**
 * Select the best feature from results
 * Prefers address features, then closest feature
 */
function selectBestFeature(
  features: MapboxFeature[],
  clickedLat: number,
  clickedLng: number
): MapboxFeature | null {
  if (features.length === 0) return null;

  // Separate address and POI features
  const addressFeatures: Array<{ feature: MapboxFeature; distance: number }> = [];
  const poiFeatures: Array<{ feature: MapboxFeature; distance: number }> = [];

  for (const feature of features) {
    const center = getFeatureCenter(feature);
    if (!center) continue;

    const distance = calculateDistance(clickedLat, clickedLng, center.lat, center.lng);

    if (isAddressFeature(feature)) {
      addressFeatures.push({ feature, distance });
    } else {
      poiFeatures.push({ feature, distance });
    }
  }

  // Prefer address features if available
  if (addressFeatures.length > 0) {
    // Sort by distance and return closest address
    addressFeatures.sort((a, b) => a.distance - b.distance);
    return addressFeatures[0].feature;
  }

  // Otherwise, return closest POI
  if (poiFeatures.length > 0) {
    poiFeatures.sort((a, b) => a.distance - b.distance);
    return poiFeatures[0].feature;
  }

  // Fallback: return first feature if we couldn't calculate distance
  return features[0];
}

/**
 * Reverse geocode coordinates to get address information
 * 
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns Geocoded address data or null if geocoding fails
 */
export async function reverseGeocode({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}): Promise<ReverseGeocodeResult | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;

  // Check token availability (log warning only once)
  if (!token) {
    if (!tokenWarningLogged) {
      log.warn(
        "VITE_MAPBOX_TOKEN is not set. Reverse geocoding will be disabled."
      );
      tokenWarningLogged = true;
    }
    return null;
  }

  // Check cache first
  const cacheKey = getCacheKey(latitude, longitude);
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }

  try {
    // Request limit=5 to get multiple candidates
    // Include permanent=true to indicate we're storing the result (required for compliance)
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}&types=address,poi&limit=5&permanent=true`;

    const response = await fetch(url);

    if (!response.ok) {
      // Don't log errors - fail silently
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const data: MapboxResponse = await response.json();

    if (!data.features || data.features.length === 0) {
      geocodeCache.set(cacheKey, null);
      return null;
    }

    // Select best feature (prefers address, then closest)
    const selectedFeature = selectBestFeature(data.features, latitude, longitude);
    if (!selectedFeature) {
      geocodeCache.set(cacheKey, null);
      return null;
    }

    // Calculate distance from clicked point to feature center
    const featureCenter = getFeatureCenter(selectedFeature);
    const distanceM = featureCenter
      ? calculateDistance(latitude, longitude, featureCenter.lat, featureCenter.lng)
      : null;

    // Extract address components from context
    let city: string | null = null;
    let region: string | null = null;
    let postalCode: string | null = null;
    let country: string | null = null;

    if (selectedFeature.context) {
      for (const ctx of selectedFeature.context) {
        const ctxId = ctx.id.split(".")[0];
        if (ctxId === "place") {
          city = ctx.text;
        } else if (ctxId === "region") {
          region = ctx.short_code || ctx.text;
        } else if (ctxId === "postcode") {
          postalCode = ctx.text;
        } else if (ctxId === "country") {
          country = ctx.text;
        }
      }
    }

    // Build address_line1: prefer feature.address + feature.text, otherwise just feature.text
    const addressLine1 = selectedFeature.address
      ? `${selectedFeature.address} ${selectedFeature.text}`
      : selectedFeature.text;

    // Determine if we should use mapbox_place_id for deduplication
    // Use it if: (1) it's an address feature, OR (2) distance <= 75m
    const isAddress = isAddressFeature(selectedFeature);
    const isCloseEnough = distanceM !== null && distanceM <= 75;
    const shouldUseMapboxId = isAddress || isCloseEnough;

    // Get place_type (first type from array, or null)
    const placeType = selectedFeature.place_type?.[0] || null;

    const result: ReverseGeocodeResult = {
      display_address: selectedFeature.place_name,
      address_line1: addressLine1,
      city,
      region,
      postal_code: postalCode,
      country,
      mapbox_place_id: shouldUseMapboxId ? selectedFeature.id : null,
      distance_m: distanceM,
      place_type: placeType,
      feature_center: featureCenter,
    };

    // Cache the result
    geocodeCache.set(cacheKey, result);
    return result;
  } catch (error) {
    // Fail silently - don't log errors
    geocodeCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Clear the geocode cache (useful for testing or if needed)
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
}
