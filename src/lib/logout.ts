/**
 * Logout and cleanup utilities
 * 
 * Provides reliable logout cleanup that ensures no user data persists after sign out.
 * Always clears local state even if remote signOut fails.
 */

import { log } from "./log";

import { supabase } from "./supabase";
import { clearGeocodeCache } from "./mapbox";

/**
 * Clear all app-specific data from localStorage
 */
function clearAppLocalStorage(): void {
  try {
    const keysToRemove: string[] = [];
    
    // Collect all keys to remove
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // App-specific keys
      if (
        key.startsWith("foodly_") ||
        key.startsWith("tanstack") ||
        // Table filters/sorts, map UI state, etc.
        key.includes("foodly") ||
        key.includes("tanstack")
      ) {
        keysToRemove.push(key);
      }
    }
    
    // Remove collected keys
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore individual key removal errors
      }
    });
    
    if (keysToRemove.length > 0) {
      log.log(`[Logout] Cleared ${keysToRemove.length} app localStorage keys`);
    }
  } catch (e) {
    // Ignore localStorage errors
    log.warn("[Logout] Error clearing app localStorage:", e);
  }
}

/**
 * Clear Supabase auth tokens from localStorage
 */
function clearSupabaseAuthTokens(): void {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) return;
    
    // Extract project ref from URL (e.g., https://xxxxx.supabase.co -> xxxxx)
    const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)/);
    const projectRef = urlMatch?.[1];
    
    if (!projectRef) return;
    
    const keysToRemove: string[] = [];
    
    // Collect Supabase auth keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      if (
        // Pattern: sb-{projectRef}-auth-token
        /^sb-.*-auth-token$/.test(key) ||
        // Pattern: supabase.auth.*
        key.startsWith("supabase.auth.") ||
        // Legacy patterns
        key.startsWith(`sb-${projectRef}-`) ||
        (key.includes("supabase") && key.includes("auth"))
      ) {
        keysToRemove.push(key);
      }
    }
    
    // Remove collected keys
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore individual key removal errors
      }
    });
    
    if (keysToRemove.length > 0) {
      log.log(`[Logout] Cleared ${keysToRemove.length} Supabase auth tokens`);
    }
  } catch (e) {
    // Ignore localStorage errors
    log.warn("[Logout] Error clearing Supabase auth tokens:", e);
  }
}

/**
 * Clear all app-specific data from sessionStorage
 */
function clearAppSessionStorage(): void {
  try {
    const keysToRemove: string[] = [];
    
    // Collect all keys to remove
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      
      // App-specific keys
      if (
        key.startsWith("foodly_") ||
        key.startsWith("tanstack") ||
        key.includes("foodly") ||
        key.includes("tanstack")
      ) {
        keysToRemove.push(key);
      }
    }
    
    // Remove collected keys
    keysToRemove.forEach(key => {
      try {
        sessionStorage.removeItem(key);
      } catch (e) {
        // Ignore individual key removal errors
      }
    });
    
    if (keysToRemove.length > 0) {
      log.log(`[Logout] Cleared ${keysToRemove.length} app sessionStorage keys`);
    }
  } catch (e) {
    // Ignore sessionStorage errors
    log.warn("[Logout] Error clearing app sessionStorage:", e);
  }
}

/**
 * Clear in-memory caches
 */
function clearInMemoryCaches(): void {
  try {
    // Clear reverse geocoding cache
    clearGeocodeCache();
    
    log.log("[Logout] Cleared in-memory caches");
  } catch (e) {
    // Ignore cache clearing errors
    log.warn("[Logout] Error clearing in-memory caches:", e);
  }
}

/**
 * DEV-only: Verify cleanup by checking for remaining keys
 */
export function verifyLogoutCleanup(): void {
  if (!import.meta.env.DEV) return;
  
  try {
    const remainingKeys: {
      localStorage: string[];
      sessionStorage: string[];
    } = {
      localStorage: [],
      sessionStorage: [],
    };
    
    // Check localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      if (
        key.startsWith("foodly_") ||
        key.startsWith("tanstack") ||
        /^sb-.*-auth-token$/.test(key) ||
        key.startsWith("supabase.auth.") ||
        (key.includes("supabase") && key.includes("auth"))
      ) {
        remainingKeys.localStorage.push(key);
      }
    }
    
    // Check sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      
      if (
        key.startsWith("foodly_") ||
        key.startsWith("tanstack")
      ) {
        remainingKeys.sessionStorage.push(key);
      }
    }
    
    if (remainingKeys.localStorage.length > 0 || remainingKeys.sessionStorage.length > 0) {
      log.warn("[Logout Verification] Remaining keys found:", remainingKeys);
    } else {
      log.log("[Logout Verification] ✓ All app keys cleared successfully");
    }
  } catch (e) {
    log.warn("[Logout Verification] Error verifying cleanup:", e);
  }
}

/**
 * Comprehensive logout and cleanup function
 * 
 * Always clears local state and storage, even if remote signOut fails.
 * This ensures the UI is clean and no user data persists after logout.
 * 
 * @param navigate - Optional navigation function (if provided, navigates to /login after cleanup)
 */
export async function logoutAndCleanup(navigate?: (to: string) => void): Promise<void> {
  log.log("[Logout] Starting logout and cleanup");
  
  try {
    // Attempt remote logout (but don't block on errors)
    try {
      await supabase.auth.signOut({ scope: "global" });
      log.log("[Logout] Remote signOut successful");
    } catch (signOutError: any) {
      // Log but don't block - we'll clean up locally anyway
      log.warn("[Logout] Remote signOut failed (non-blocking):", signOutError);
    }
  } finally {
    // Always run cleanup, regardless of signOut success/failure
    
    // 1. Clear app-specific localStorage
    clearAppLocalStorage();
    
    // 2. Clear Supabase auth tokens
    clearSupabaseAuthTokens();
    
    // 3. Clear app-specific sessionStorage
    clearAppSessionStorage();
    
    // 4. Clear in-memory caches
    clearInMemoryCaches();
    
    // 5. DEV-only verification
    verifyLogoutCleanup();
    
    log.log("[Logout] Cleanup complete");
    
    // 6. Navigate to login if navigate function provided
    if (navigate) {
      navigate("/login");
    }
  }
}
