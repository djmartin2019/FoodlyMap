-- Update the existing "users can read own profile" policy to allow
-- authenticated users to read all profiles (needed for feed page usernames)
-- This replaces the restrictive policy that only allowed reading own profile
ALTER POLICY "users can read own profile"
  ON profiles
  TO authenticated
  USING (true);
