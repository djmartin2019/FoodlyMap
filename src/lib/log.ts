/**
 * Development-only logging utility with PII redaction
 * 
 * In production builds, all logs are suppressed to prevent exposure of:
 * - PII (emails, user IDs, phone numbers)
 * - Authentication tokens (access tokens, refresh tokens, JWTs)
 * - Session data
 * - Raw Supabase error objects with headers
 * 
 * In development, logs are emitted but sensitive keys are redacted
 * before output to prevent accidental exposure in screenshots/logs.
 */

// Keys that commonly contain secrets or PII - these will be redacted
const SENSITIVE_KEYS = new Set([
  "access_token",
  "refresh_token",
  "token",
  "authorization",
  "password",
  "email",
  "phone",
  "user_id",
  "id",
  "jwt",
  "session",
  "supabase",
  "cookie",
  "auth_token",
  "api_key",
  "secret",
  "credentials",
]);

// Maximum string length before truncation
const MAX_STRING_LENGTH = 200;

/**
 * Redact sensitive values from an object recursively
 */
function redactObject(obj: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return "[Max depth reached]";
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  // Handle primitives
  if (typeof obj !== "object") {
    if (typeof obj === "string" && obj.length > MAX_STRING_LENGTH) {
      return obj.substring(0, MAX_STRING_LENGTH) + "... [truncated]";
    }
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, depth + 1));
  }

  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Handle Error objects - extract safe properties
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: import.meta.env.DEV ? obj.stack : "[redacted]",
    };
  }

  // Handle Supabase error objects - only include safe fields
  if (obj && typeof obj === "object" && "message" in obj && "code" in obj) {
    const safeError: any = {};
    if ("message" in obj) safeError.message = obj.message;
    if ("code" in obj) safeError.code = obj.code;
    if ("status" in obj) safeError.status = obj.status;
    return safeError;
  }

  // Handle regular objects - redact sensitive keys
  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key matches any sensitive pattern
    const isSensitive = Array.from(SENSITIVE_KEYS).some((sensitive) =>
      lowerKey.includes(sensitive)
    );

    if (isSensitive) {
      redacted[key] = "[redacted]";
    } else {
      redacted[key] = redactObject(value, depth + 1);
    }
  }

  return redacted;
}

/**
 * Format arguments for logging, redacting sensitive data
 */
function formatArgs(args: any[]): any[] {
  if (!import.meta.env.DEV) {
    return []; // Don't process in production
  }

  return args.map((arg) => {
    if (typeof arg === "string") {
      // Check if string contains potential tokens (long base64-like strings)
      if (arg.length > 50 && /^[A-Za-z0-9+/=_-]+$/.test(arg)) {
        // Might be a token, truncate it
        return arg.substring(0, 20) + "... [redacted]";
      }
      // Truncate very long strings
      if (arg.length > MAX_STRING_LENGTH) {
        return arg.substring(0, MAX_STRING_LENGTH) + "... [truncated]";
      }
      return arg;
    }

    if (typeof arg === "object" && arg !== null) {
      return redactObject(arg);
    }

    return arg;
  });
}

/**
 * Development-only logger
 * All methods are no-ops in production builds
 */
export const log = {
  /**
   * Log informational messages (dev only)
   */
  log: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.log(...formatArgs(args));
    }
  },

  /**
   * Log warnings (dev only)
   */
  warn: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.warn(...formatArgs(args));
    }
  },

  /**
   * Log errors (dev only)
   * Note: User-facing error messages/toasts should use UI components, not this logger
   */
  error: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.error(...formatArgs(args));
    }
  },

  /**
   * Log debug messages (dev only)
   */
  debug: (...args: any[]) => {
    if (import.meta.env.DEV) {
      console.debug(...formatArgs(args));
    }
  },
};
