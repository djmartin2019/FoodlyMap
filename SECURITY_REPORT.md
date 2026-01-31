# Security Sweep Report - Foodly Map

**Date:** 2026-01-31  
**Scope:** Client-side code, Edge Functions, Supabase usage, XSS risks, secrets management

---

## ✅ SECURE AREAS

### 1. Supabase Service Role Key
- **Status:** ✅ **SECURE**
- **Location:** `functions/l/[slug].ts` only
- **Finding:** Service role key is ONLY used in Cloudflare Pages Function (server-side). Client code correctly uses `VITE_SUPABASE_ANON_KEY`.
- **Evidence:**
  - `src/lib/supabase.ts` uses `VITE_SUPABASE_ANON_KEY` (correct)
  - `functions/l/[slug].ts` uses `SUPABASE_SERVICE_ROLE_KEY` from env (correct)
  - No service role key found in client code

### 2. Environment Variables
- **Status:** ✅ **SECURE**
- **Finding:** Only `VITE_*` prefixed variables are used in client code, which is correct for Vite.
- **Evidence:**
  - `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in client
  - `VITE_MAPBOX_TOKEN` in client
  - Service role key only in edge function env

### 3. Public List Queries
- **Status:** ✅ **SECURE**
- **Location:** `src/pages/PublicListPage.tsx`
- **Finding:** Queries properly filter by `slug` and check `visibility === 'public'`. RLS should also enforce this.
- **Evidence:**
  ```typescript
  .from("lists")
  .select("id, name, description, visibility, owner_id, created_at, updated_at, slug")
  .eq("slug", slug)
  .maybeSingle();
  // Then checks: if (data.visibility !== "public")
  ```

### 4. React User Input Rendering
- **Status:** ✅ **SECURE**
- **Finding:** Most user-provided text (list names, descriptions, notes, place names) is rendered via React JSX, which automatically escapes HTML.
- **Evidence:**
  - `{list.name}`, `{list.description}`, `{place.note}` in JSX (safe)
  - No `dangerouslySetInnerHTML` found in codebase

---

## ⚠️ SECURITY ISSUES FOUND

### 1. **CRITICAL: XSS Risk in Mapbox Popups**
- **Severity:** 🔴 **HIGH**
- **Location:** 
  - `src/components/DashboardMap.tsx` (lines 308-322)
  - `src/pages/DashboardPage.tsx` (line 98)
- **Issue:** User-provided data (place names, addresses, category names) is directly interpolated into HTML strings passed to `mapboxgl.Popup.setHTML()` without escaping.
- **Risk:** Malicious user could inject JavaScript by creating a place with a name like `<img src=x onerror="alert('XSS')">`.
- **Vulnerable Code:**
  ```typescript
  // DashboardMap.tsx line 310
  const popupContent = `
    <div style="...">
      <div>${place.name}</div>  // ⚠️ Unescaped user input
      ${place.display_address ? `<div>${place.display_address}</div>` : ''}  // ⚠️ Unescaped
      ${place.category_name ? `<div>${place.category_name}</div>` : ''}  // ⚠️ Unescaped
    </div>
  `;
  popup.setHTML(popupContent);
  ```
- **Fix Required:**
  ```typescript
  // Add HTML escaping function
  function escapeHtml(text: string | null | undefined): string {
    if (!text) return '';
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
  
  // Use it:
  const popupContent = `
    <div style="...">
      <div>${escapeHtml(place.name)}</div>
      ${place.display_address ? `<div>${escapeHtml(place.display_address)}</div>` : ''}
      ${place.category_name ? `<div>${escapeHtml(place.category_name)}</div>` : ''}
    </div>
  `;
  ```

### 2. **MEDIUM: Edge Function Slug Validation**
- **Severity:** 🟡 **MEDIUM**
- **Location:** `functions/l/[slug].ts` (line 198)
- **Issue:** Slug parameter is not validated for length or pattern before use in Supabase query.
- **Risk:** Extremely long slugs could cause performance issues or potential DoS. Malformed slugs could cause query errors.
- **Current Code:**
  ```typescript
  const slug = params.slug as string;
  if (!slug) {
    return context.next();
  }
  // No validation on slug length or format
  ```
- **Fix Required:**
  ```typescript
  const slug = params.slug as string;
  if (!slug) {
    return context.next();
  }
  
  // Validate slug: alphanumeric, hyphens, underscores, max 100 chars
  const slugPattern = /^[a-zA-Z0-9_-]{1,100}$/;
  if (!slugPattern.test(slug)) {
    // Invalid slug - return generic OG tags
    const html = generateOGHTML(null, slug, baseUrl);
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
  ```

### 3. **LOW: Console Logging in Production**
- **Severity:** 🟢 **LOW**
- **Location:** Multiple files
- **Issue:** Some `console.log`/`console.error` statements may execute in production (not all are wrapped in `import.meta.env.DEV` checks).
- **Risk:** Minor - could leak debugging info or error details to browser console.
- **Examples:**
  - `src/pages/PublicListPage.tsx` line 191: `console.error("Error checking existing places:", checkError);`
  - `src/pages/PublicListPage.tsx` line 217: `console.error("Error saving places:", insertError);`
- **Fix Required:** Wrap all console statements in `if (import.meta.env.DEV) { ... }` or remove them.

---

## 📋 RECOMMENDATIONS

### Immediate Actions (High Priority)
1. **Fix XSS in Mapbox popups** - Add HTML escaping to all user input in `setHTML()` calls
2. **Add slug validation** in edge function

### Best Practices (Medium Priority)
3. **Review RLS policies** - Ensure all Supabase tables have proper RLS policies (not in codebase, but verify in Supabase dashboard)
4. **Add input length limits** - Enforce max lengths on list names, descriptions, place names (both client and server)
5. **Sanitize console logs** - Wrap all console statements in DEV checks

### Future Considerations
6. **Content Security Policy (CSP)** - Add CSP headers to prevent inline script execution
7. **Rate limiting** - Consider rate limiting on public list queries to prevent enumeration
8. **Input validation** - Add schema validation (e.g., Zod) for all user inputs before database operations

---

## 🔍 VERIFICATION CHECKLIST

- [x] Service role key only in edge functions
- [x] Only VITE_* env vars in client
- [x] No dangerouslySetInnerHTML in React components
- [x] Public list queries filter by visibility
- [ ] **Mapbox popups escape user input** ⚠️ **NEEDS FIX**
- [ ] **Edge function validates slug input** ⚠️ **NEEDS FIX**
- [ ] All console logs wrapped in DEV checks (partial)

---

## 📝 NOTES

- **RLS Policies:** Cannot verify RLS policies from codebase. Ensure in Supabase dashboard that:
  - `lists` table: Users can only read public lists or lists they own
  - `list_places` table: Users can only read list_places for lists they can access
  - `user_places` table: Users can only read/modify their own user_places
  - `places` table: Users can read places they have access to via user_places or list_places
- **Database Schema:** Cannot verify from codebase. Ensure:
  - No `WITH CHECK (true)` policies on INSERT/UPDATE/DELETE (these bypass RLS)
  - All policies use `auth.uid()` for user-scoped operations
- **Secrets:** No secrets found in committed code (good). Ensure `.env` files are in `.gitignore`.

---

**Report Generated:** 2026-01-31  
**Next Review:** After fixes are applied
