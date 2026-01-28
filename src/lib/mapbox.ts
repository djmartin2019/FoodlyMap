/**
 * Mapbox reverse geocoding utility
 * 
 * Fetches address information from Mapbox Geocoding API based on lat/lng coordinates.
 */

interface ReverseGeocodeResult {
  display_address: string;
  address_line1: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  mapbox_place_id: string;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  text: string;
  address?: string;
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
      console.warn(
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
    // Include permanent=true to indicate we're storing the result (required for compliance)
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}&types=address,poi&limit=1&permanent=true`;

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

    const feature = data.features[0];

    // Extract address components from context
    let city: string | null = null;
    let region: string | null = null;
    let postalCode: string | null = null;
    let country: string | null = null;

    if (feature.context) {
      for (const ctx of feature.context) {
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
    const addressLine1 = feature.address
      ? `${feature.address} ${feature.text}`
      : feature.text;

    const result: ReverseGeocodeResult = {
      display_address: feature.place_name,
      address_line1: addressLine1,
      city,
      region,
      postal_code: postalCode,
      country,
      mapbox_place_id: feature.id,
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
