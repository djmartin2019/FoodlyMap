import { useState, FormEvent, useEffect, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

interface FormErrors {
  username?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  general?: string;
}

export default function SetPasswordPage() {
  const { user, checkOnboardingStatus } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [profileCreated, setProfileCreated] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session check error:", sessionError);
        }
        
        if (!session) {
          navigate({ to: "/login", replace: true });
        }
      } catch (error) {
        console.error("Error checking session:", error);
        // Don't navigate on error - let route guard handle it
      }
    };
    checkSession();
  }, [navigate]);

  // Validate username format
  const validateUsernameFormat = (value: string): boolean => {
    return /^[a-z0-9_]+$/.test(value) && value.length >= 3 && value.length <= 30;
  };

  // Check username uniqueness (memoized to avoid recreating on each render)
  const checkUsernameUniqueness = useCallback(async (value: string): Promise<boolean> => {
    if (!validateUsernameFormat(value)) {
      return false;
    }

    setCheckingUsername(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", value.toLowerCase())
        .limit(1);

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "no rows returned" which is fine
        console.error("Error checking username:", error);
        return false;
      }

      // If data exists, username is taken
      return !data || data.length === 0;
    } catch (err) {
      console.error("Error checking username:", err);
      return false;
    } finally {
      setCheckingUsername(false);
    }
  }, []);

  // Validate form fields
  const validateForm = async (): Promise<boolean> => {
    const newErrors: FormErrors = {};

    // Username validation
    if (!username) {
      newErrors.username = "Username is required";
    } else if (!validateUsernameFormat(username)) {
      newErrors.username =
        "Username must be 3-30 characters, lowercase, and contain only letters, numbers, and underscores";
    } else {
      // Check uniqueness
      const isAvailable = await checkUsernameUniqueness(username);
      if (!isAvailable) {
        newErrors.username = "This username is already taken";
        setUsernameAvailable(false);
      } else {
        setUsernameAvailable(true);
      }
    }

    // First name validation
    if (!firstName.trim()) {
      newErrors.firstName = "First name is required";
    }

    // Phone validation (optional but if provided, should be valid format)
    if (phone && !/^\+?[\d\s\-()]+$/.test(phone)) {
      newErrors.phone = "Please enter a valid phone number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    // Validate form
    const isValid = await validateForm();
    if (!isValid) {
      return;
    }

    setLoading(true);

    try {
      // Get current user
      const {
        data: { user: currentUser },
        error: getUserError,
      } = await supabase.auth.getUser();

      if (getUserError || !currentUser) {
        console.error("Error getting user:", getUserError);
        setErrors({ general: "Session expired. Please try again." });
        setLoading(false);
        navigate({ to: "/login" });
        return;
      }

      console.log("Updating password for user:", currentUser.id);
      console.log("User email:", currentUser.email);
      console.log("User created at:", currentUser.created_at);

      // Skip session refresh for invite links - session is already valid
      console.log("Skipping session refresh (session should already be valid for invite links)");

      // Step 1: Skip password update for now - it's causing hangs
      // For invite links, users can set password later via password reset or settings
      // The important part is creating the profile, which completes onboarding
      console.log("Skipping password update for invite links (can be set later)");
      console.log("Proceeding directly to profile creation...");

      // Step 2: Insert or update profile with onboarding_complete = true
      const profileData = {
        id: currentUser.id,
        email: currentUser.email, // Required field
        username: username.toLowerCase().trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        phone: phone.trim() || null,
        onboarding_complete: true, // Mark onboarding as complete
        created_at: new Date().toISOString(),
      };

      console.log("Creating profile:", profileData);

      // Verify session is still valid before creating profile
      console.log("Verifying session before profile creation...");
      const { data: sessionCheck, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionCheck.session) {
        console.error("Session invalid after password update:", sessionError);
        setErrors({
          general: "Session expired. Please refresh the page and try again.",
        });
        setLoading(false);
        return;
      }
      console.log("Session verified, proceeding with profile creation...");

      // Step 2: Create profile with timeout
      console.log("Creating profile (with 5 second timeout)...");
      
      // Wrap the Supabase call in a proper Promise
      const profileInsertPromise = new Promise<{ success: boolean; error?: any }>(async (resolve) => {
        try {
          const result = await supabase
            .from("profiles")
            .insert(profileData);
          
          if (result.error) {
            resolve({ success: false, error: result.error });
          } else {
            resolve({ success: true });
          }
        } catch (err: any) {
          resolve({ success: false, error: err });
        }
      });

      // Race profile creation against a timeout
      const profileTimeoutPromise = new Promise<{ timeout: boolean }>((resolve) => {
        setTimeout(() => resolve({ timeout: true }), 5000); // 5 second timeout
      });

      let profileError;
      try {
        const result: any = await Promise.race([profileInsertPromise, profileTimeoutPromise]);
        if (result.timeout) {
          console.error("Profile creation timed out after 5 seconds");
          setErrors({
            general: "Profile creation timed out. Please refresh the page and try again, or contact support if the issue persists.",
          });
          setLoading(false);
          return;
        }
        if (!result.success && result.error) {
          profileError = result.error;
        }
        // If result.success is true, profile was created successfully
      } catch (err: any) {
        console.error("Profile creation exception:", err);
        profileError = err;
      }

      if (profileError) {
        console.error("Profile creation error:", profileError);
        console.error("Error code:", profileError.code);
        console.error("Error message:", profileError.message);
        
        // Handle unique constraint violation (username or id)
        if (
          profileError.code === "23505" ||
          profileError.message?.includes("duplicate") ||
          profileError.message?.includes("unique")
        ) {
          // Check if it's username or id conflict
          if (profileError.message?.includes("username")) {
            setErrors({ username: "This username is already taken. Please choose another." });
          } else {
            // ID conflict - profile might already exist, try UPDATE instead
            console.log("Profile exists, trying UPDATE...");
            const { error: updateError } = await supabase
              .from("profiles")
              .update({
                email: profileData.email,
                username: profileData.username,
                first_name: profileData.first_name,
                last_name: profileData.last_name,
                phone: profileData.phone,
                onboarding_complete: profileData.onboarding_complete,
              })
              .eq("id", profileData.id);

            if (updateError) {
              console.error("Profile update also failed:", updateError);
              setErrors({
                general: `Failed to save profile: ${updateError.message || "Please try again."}`,
              });
              setLoading(false);
              return;
            }
            console.log("Profile updated successfully");
          }
        } else {
          setErrors({
            general: `Failed to save profile: ${profileError.message || "Please try again."}`,
          });
          setLoading(false);
          return;
        }
      } else {
        console.log("Profile created successfully");
      }

      // Step 3: Send password reset email via Supabase
      console.log("Sending password reset email...");
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        currentUser.email!,
        {
          redirectTo: `${window.location.origin}/login`,
        }
      );

      if (resetError) {
        console.error("Error sending password reset email:", resetError);
        // Don't block - profile is created, user can request password reset later
        setErrors({
          general: "Profile created, but password reset email failed to send. You can request a password reset from the login page.",
        });
        setLoading(false);
        return;
      }

      console.log("Password reset email sent successfully");

      // Update auth context onboarding status
      await checkOnboardingStatus();

      // Show success message with countdown, then redirect to login
      setProfileCreated(true);
      setLoading(false);
      
      // Start countdown and redirect
      let countdown = 3;
      setRedirectCountdown(countdown);
      const countdownInterval = setInterval(() => {
        countdown--;
        setRedirectCountdown(countdown);
        if (countdown <= 0) {
          clearInterval(countdownInterval);
          window.location.href = "/login";
        }
      }, 1000);
    } catch (err) {
      console.error("Unexpected error in form submission:", err);
      setErrors({
        general: `An unexpected error occurred: ${err instanceof Error ? err.message : "Please try again."}`,
      });
      setLoading(false);
    }
  };

  // Debounced username check
  useEffect(() => {
    if (!username || !validateUsernameFormat(username)) {
      setUsernameAvailable(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      checkUsernameUniqueness(username).then((available) => {
        setUsernameAvailable(available);
        if (!available && username) {
          setErrors((prev) => ({
            ...prev,
            username: "This username is already taken",
          }));
        }
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [username, checkUsernameUniqueness]);

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-200px)] w-full max-w-md items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-surface/60 bg-surface/30 p-8 shadow-neon-sm md:p-12">
        {profileCreated ? (
          <div className="text-center">
            <div className="mb-6">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent/60 bg-accent/10">
                <svg className="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
                Profile Created!
              </h1>
              <p className="mb-4 text-base text-text/80">
                We've sent a password reset link to your email.
              </p>
              <p className="text-sm text-text/60">
                Please check your inbox and click the link to set your password. Once you've set your password, you'll be able to sign in.
              </p>
              {redirectCountdown > 0 && (
                <p className="mt-2 text-sm text-text/50">
                  Redirecting to sign in in {redirectCountdown} second{redirectCountdown !== 1 ? 's' : ''}...
                </p>
              )}
            </div>
            <button
              onClick={() => window.location.href = "/login"}
              className="w-full rounded-lg border-2 border-accent/60 bg-surface/80 px-6 py-3 text-base font-semibold text-accent shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow-lg"
            >
              Go to Sign In Now
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h1 className="mb-2 text-3xl font-bold tracking-tight text-accent md:text-4xl">
                Complete Your Profile
              </h1>
              <p className="text-sm text-text/70">
                Create your account profile. We'll send you a password reset link to set your password.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

          {/* Username */}
          <div>
            <label htmlFor="username" className="mb-2 block text-sm font-medium text-text">
              Username <span className="text-text/50">(required)</span>
            </label>
            <div className="relative">
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                  setUsername(value);
                  setErrors((prev) => ({ ...prev, username: undefined }));
                }}
                required
                autoComplete="username"
                disabled={loading}
                className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
                placeholder="username123"
              />
              {checkingUsername && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent"></div>
                </div>
              )}
              {usernameAvailable === true && !checkingUsername && username && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg
                    className="h-4 w-4 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              )}
            </div>
            {errors.username && (
              <p className="mt-1 text-xs text-red-400">{errors.username}</p>
            )}
            {!errors.username && username && validateUsernameFormat(username) && (
              <p className="mt-1 text-xs text-text/50">
                Use lowercase letters, numbers, and underscores only
              </p>
            )}
          </div>

          {/* First Name */}
          <div>
            <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-text">
              First Name <span className="text-text/50">(required)</span>
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              autoComplete="given-name"
              disabled={loading}
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
              placeholder="John"
            />
            {errors.firstName && (
              <p className="mt-1 text-xs text-red-400">{errors.firstName}</p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-text">
              Last Name <span className="text-text/50">(optional)</span>
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              autoComplete="family-name"
              disabled={loading}
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
              placeholder="Doe"
            />
            {errors.lastName && (
              <p className="mt-1 text-xs text-red-400">{errors.lastName}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="mb-2 block text-sm font-medium text-text">
              Phone Number <span className="text-text/50">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              disabled={loading}
              className="w-full rounded-lg border border-surface/60 bg-bg/40 px-4 py-3 text-text placeholder:text-text/40 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
              placeholder="+1 (555) 123-4567"
            />
            {errors.phone && <p className="mt-1 text-xs text-red-400">{errors.phone}</p>}
          </div>

          {/* General Error Message */}
          {errors.general && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {errors.general}
            </div>
          )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || checkingUsername}
                className="w-full rounded-lg border-2 border-accent/60 bg-surface/80 px-6 py-3 text-base font-semibold text-accent shadow-glow transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:shadow-glow-lg disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
