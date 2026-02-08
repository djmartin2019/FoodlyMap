/**
 * Place creation and deduplication helpers
 * 
 * Handles finding existing places and creating new ones with proper deduplication:
 * 1. First checks by mapbox_place_id (if present)
 * 2. Falls back to (name_norm, lat_round, lng_round) matching
 * 3. Never inserts generated columns (name_norm, lat_round, lng_round)
 */

import { log } from "./log";
import { supabase } from "./supabase";

export interface PlaceInsertData {
  name: string;
  latitude: number;
  longitude: number;
  display_address?: string | null;
  address_line1?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  mapbox_place_id?: string | null;
  geocoded_at?: string | null;
  created_by?: string | null;
}

export interface ExistingPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  display_address?: string | null;
  created_at?: string;
  verified?: boolean;
}

/**
 * Normalize name to match database behavior (lowercase, trimmed)
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Round coordinates to 5 decimals to match database behavior
 */
function roundCoordinate(coord: number): number {
  return Number(coord.toFixed(5));
}

/**
 * Find existing place by mapbox_place_id
 */
async function findPlaceByMapboxId(
  mapboxPlaceId: string
): Promise<ExistingPlace | null> {
  const { data, error } = await supabase
    .from("places")
    .select("id, name, latitude, longitude, display_address, created_at, verified")
    .eq("mapbox_place_id", mapboxPlaceId)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV) {
      log.error("Error finding place by mapbox_place_id:", error);
    }
    return null;
  }

  return data;
}

/**
 * Find existing place by fallback method (name_norm, lat_round, lng_round)
 */
async function findPlaceByFallback(
  name: string,
  latitude: number,
  longitude: number
): Promise<ExistingPlace | null> {
  const nameNorm = normalizeName(name);
  const latRound = roundCoordinate(latitude);
  const lngRound = roundCoordinate(longitude);

  const { data, error } = await supabase
    .from("places")
    .select("id, name, latitude, longitude, display_address, created_at, verified")
    .eq("name_norm", nameNorm)
    .eq("lat_round", latRound)
    .eq("lng_round", lngRound)
    .maybeSingle();

  if (error) {
    if (import.meta.env.DEV) {
      log.error("Error finding place by fallback:", error);
    }
    return null;
  }

  return data;
}

/**
 * Find existing place using deduplication logic
 * 
 * Note: mapbox_place_id is only provided when it's safe to use for deduplication
 * (i.e., from an address feature or within 75m). If null, we skip mapbox dedupe.
 * 
 * @param name - Place name
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @param mapboxPlaceId - Optional Mapbox place ID (only set when valid for dedupe)
 * @returns Existing place if found, null otherwise
 */
export async function findExistingPlace({
  name,
  latitude,
  longitude,
  mapboxPlaceId,
}: {
  name: string;
  latitude: number;
  longitude: number;
  mapboxPlaceId?: string | null;
}): Promise<{ place: ExistingPlace | null; method: "mapbox_place_id" | "fallback" | null }> {
  // First, try mapbox_place_id if available
  // Note: mapbox_place_id is only set when it's safe to use (address feature or <= 75m)
  if (mapboxPlaceId) {
    const place = await findPlaceByMapboxId(mapboxPlaceId);
    if (place) {
      return { place, method: "mapbox_place_id" };
    }
  }

  // Fallback to name + rounded coordinates
  const place = await findPlaceByFallback(name, latitude, longitude);
  if (place) {
    return { place, method: "fallback" };
  }

  return { place: null, method: null };
}

/**
 * Create sanitized place insert payload (excludes generated columns)
 */
function createPlaceInsertPayload(data: PlaceInsertData) {
  return {
    name: data.name,
    latitude: data.latitude,
    longitude: data.longitude,
    display_address: data.display_address ?? null,
    address_line1: data.address_line1 ?? null,
    city: data.city ?? null,
    region: data.region ?? null,
    postal_code: data.postal_code ?? null,
    country: data.country ?? null,
    mapbox_place_id: data.mapbox_place_id ?? null,
    geocoded_at: data.geocoded_at ?? null,
    created_by: data.created_by ?? null,
    // Explicitly DO NOT include:
    // - name_norm (generated column)
    // - lat_round (generated column)
    // - lng_round (generated column)
    // - id (auto-generated)
    // - created_at (auto-generated)
  };
}

/**
 * Create a new place or get existing one
 * 
 * Handles deduplication and race conditions:
 * 1. Checks for existing place first
 * 2. If not found, inserts new place
 * 3. If insert fails due to unique constraint, re-fetches existing place
 * 
 * @param data - Place data to create
 * @returns The place (existing or newly created)
 */
export async function createOrGetPlace(
  data: PlaceInsertData
): Promise<ExistingPlace> {
  // Step 1: Check if place already exists
  const { place: existingPlace } = await findExistingPlace({
    name: data.name,
    latitude: data.latitude,
    longitude: data.longitude,
    mapboxPlaceId: data.mapbox_place_id ?? undefined,
  });

  if (existingPlace) {
    return existingPlace;
  }

  // Step 2: Place doesn't exist, create it
  const placeDataToInsert = createPlaceInsertPayload(data);

  const { data: newPlace, error: insertError } = await supabase
    .from("places")
    .insert([placeDataToInsert])
    .select("id, name, latitude, longitude, display_address, created_at, verified")
    .single();

  if (insertError) {
    // Handle race condition: if unique constraint violation, try to find existing place
    if (insertError.code === "23505" || insertError.message?.includes("unique")) {
      // Re-fetch the existing place
      const { place: racePlace } = await findExistingPlace({
        name: data.name,
        latitude: data.latitude,
        longitude: data.longitude,
        mapboxPlaceId: data.mapbox_place_id ?? undefined,
      });

      if (racePlace) {
        return racePlace;
      }

      // If we still can't find it, something went wrong
      if (import.meta.env.DEV) {
        log.error("[Place Create] Race condition but couldn't find existing place:", insertError);
      }
      throw new Error("Failed to create place due to conflict. Please try again.");
    }

    // Other errors
    if (import.meta.env.DEV) {
      log.error("[Place Create] Error creating place:", insertError);
      log.error("[Place Create] Place data attempted:", placeDataToInsert);
    }
    throw new Error(`Failed to create place: ${insertError.message || "Unknown error"}`);
  }

  if (!newPlace) {
    throw new Error("Failed to create place: No data returned");
  }

  return newPlace;
}
