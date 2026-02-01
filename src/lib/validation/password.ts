/**
 * Password validation helpers
 * 
 * Ensures UI validation matches Supabase password policy (minimum 8 characters).
 * This provides immediate feedback to users before submission and prevents
 * unnecessary API calls with invalid passwords.
 */

/**
 * Minimum password length enforced by Supabase
 * Keep this aligned with Supabase Auth password policy
 */
export const PASSWORD_MIN_LEN = 8;

/**
 * Validate password meets minimum requirements
 * 
 * @param password - Password to validate
 * @returns Error message if invalid, null if valid
 */
export function validatePassword(password: string): string | null {
  if (!password) {
    return "Password is required";
  }
  
  if (password.length < PASSWORD_MIN_LEN) {
    return "Password must be at least 8 characters.";
  }
  
  return null;
}

/**
 * Validate password confirmation matches password
 * 
 * @param password - Original password
 * @param confirm - Confirmation password
 * @returns Error message if invalid, null if valid
 */
export function validatePasswordConfirm(password: string, confirm: string): string | null {
  if (!confirm) {
    return "Please confirm your password";
  }
  
  if (password !== confirm) {
    return "Passwords do not match.";
  }
  
  return null;
}
