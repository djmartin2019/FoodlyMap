# CI/CD Pipeline Documentation

This document describes the simplified, production-ready CI/CD pipeline for Foodly Map.

## Overview

Our CI/CD pipeline uses GitHub Actions for quality gates and security monitoring, while Cloudflare Pages handles all deployments automatically.

## Pipeline Architecture

The pipeline consists of three workflows:

1. **CI** - Single required check (lint, typecheck, test, build)
2. **Security** - Weekly monitoring and alerts (non-blocking)
3. **Release** - Sentry sourcemap uploads (runs on main branch)

## Workflows

### 1. CI Workflow (`.github/workflows/ci.yml`)

**Status:** ✅ **REQUIRED** - This is the only check required for branch protection

**Triggers:**
- Pull requests to `main`
- Pushes to `main`

**Job:** `ci`
- Runs sequentially: install → lint → typecheck → test → build
- Node.js 20 only
- Uses npm caching

**Branch Protection:**
- Only the `ci` job should be required
- All steps must pass for PR to be mergeable

### 2. Security Workflow (`.github/workflows/security.yml`)

**Status:** ℹ️ **INFORMATIONAL** - Does not block merges

**Triggers:**
- Pushes to `main`
- Weekly schedule (Mondays at 00:00 UTC)

**Jobs:**
- **npm Audit** - Scans production dependencies, fails only on HIGH/CRITICAL
- **Dependency Review** - Reviews dependency changes in PRs (PRs only)
- **CodeQL Analysis** - Static code security analysis (non-blocking)

**Features:**
- Only fails on HIGH/CRITICAL vulnerabilities
- CodeQL runs but doesn't block (continue-on-error: true)
- Results visible in GitHub Security tab

### 3. Release Workflow (`.github/workflows/release.yml`)

**Status:** ℹ️ **AUTOMATIC** - Runs on push to main

**Triggers:**
- Push to `main` branch

**Job:** `sentry-release`
- Builds project with production environment variables
- Creates Sentry release
- Uploads sourcemaps to Sentry
- Associates commits with release

**Note:** This workflow does NOT deploy to Cloudflare. Cloudflare Pages handles deployments automatically.

## Deployment

### Cloudflare Pages (Automatic)

**Preview Deployments:**
- Automatically created for every PR
- Configured in Cloudflare Pages dashboard
- No GitHub Actions workflow needed

**Production Deployments:**
- Automatically deployed on merge to `main`
- Configured in Cloudflare Pages dashboard
- No GitHub Actions workflow needed

**Configuration:**
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: 20

### Sentry Releases

- Automatically created on push to `main` via `release.yml` workflow
- Sourcemaps uploaded for better error tracking
- Commits associated with releases

## Required GitHub Secrets

### For Release Workflow (Sentry)

- `SENTRY_AUTH_TOKEN` - Sentry authentication token
  - Generate at: https://sentry.io/settings/account/api/auth-tokens/
  - Required scopes: `project:read`, `project:releases`, `org:read`
- `SENTRY_ORG` - Your Sentry organization slug
- `SENTRY_PROJECT` - Your Sentry project slug

### For Build (Optional - only if CI needs to build)

These are typically set in Cloudflare Pages, but can be added to GitHub Secrets if CI workflow needs them:

- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key
- `VITE_SENTRY_DSN` - Sentry DSN (optional)
- `VITE_MAPBOX_TOKEN` - Mapbox access token

**Note:** CI workflow currently doesn't need these since it only validates code quality, not building with environment variables.

## Cloudflare Pages Configuration

### Environment Variables

Configure these in Cloudflare Pages dashboard (`Settings > Environment variables`):

**Production Environment:**
- `VITE_SUPABASE_URL` - Frontend build-time variable (safe to expose)
- `VITE_SUPABASE_ANON_KEY` - Frontend build-time variable (safe to expose)
- `VITE_SENTRY_DSN` - Frontend build-time variable (safe to expose)
- `VITE_MAPBOX_TOKEN` - Frontend build-time variable (safe to expose)
- `SUPABASE_URL` - Server-side only (for Pages Functions)
- `SUPABASE_SERVICE_ROLE_KEY` - **SERVER-SIDE ONLY** - Must NEVER be in frontend code or `/src` directory

**Preview Environment:**
- Inherits from production
- Can override specific variables if needed

### Security Notes

**Critical:** `SUPABASE_SERVICE_ROLE_KEY`
- ✅ **ONLY** set in Cloudflare Pages Functions environment
- ✅ **ONLY** used in `/functions` directory (server-side)
- ❌ **NEVER** in `VITE_*` variables
- ❌ **NEVER** referenced in `/src` directory
- ❌ **NEVER** in frontend code

**Safe to Expose:**
- All `VITE_*` variables are build-time and end up in client code
- These are safe to expose (they're public anyway)

## Branch Protection Setup

See [BRANCH_PROTECTION.md](./BRANCH_PROTECTION.md) for detailed instructions.

**Quick Summary:**
1. Go to Settings → Branches
2. Add rule for `main` branch
3. Require status checks: **ONLY select `ci`**
4. Do NOT select individual checks (lint, test, build)
5. Do NOT select security workflow checks

## Workflow Summary

| Workflow | Required? | Triggers | Purpose |
|----------|-----------|----------|---------|
| `ci` | ✅ Yes | PRs, push to main | Quality gate (lint, typecheck, test, build) |
| `security` | ❌ No | Weekly, push to main | Monitoring and alerts |
| `release` | ❌ No | Push to main | Sentry sourcemap uploads |

## Troubleshooting

### CI Failures

1. Check GitHub Actions logs for specific error
2. Verify Node.js 20 is available
3. Check for dependency issues
4. Ensure all required scripts exist in `package.json`

### Security Alerts

1. Review npm audit results (only HIGH/CRITICAL block)
2. Check CodeQL alerts in Security tab (informational)
3. Update vulnerable dependencies
4. Security workflow failures don't block merges

### Deployment Issues

1. Check Cloudflare Pages dashboard for deployment status
2. Verify environment variables are set correctly
3. Check build logs in Cloudflare Pages
4. Verify build command and output directory

### Sentry Release Issues

1. Verify Sentry secrets are set correctly
2. Check release workflow logs
3. Ensure sourcemaps are generated (`sourcemap: true` in vite.config.ts)
4. Verify Sentry auth token has correct permissions

## Best Practices

1. **Always test on preview before production**
   - Cloudflare automatically creates previews for PRs
   - Test on multiple browsers/devices

2. **Review security alerts weekly**
   - Check GitHub Security tab
   - Address HIGH/CRITICAL vulnerabilities promptly
   - CodeQL alerts are informational

3. **Keep dependencies updated**
   - Review Dependabot PRs weekly
   - Test dependency updates on preview

4. **Monitor deployment status**
   - Check Cloudflare Pages dashboard after merges
   - Monitor Sentry for new errors after deployment

5. **Use meaningful commit messages**
   - Helps with Sentry release tracking
   - Makes debugging easier

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Sentry Release Tracking](https://docs.sentry.io/product/releases/)
- [CodeQL Documentation](https://codeql.github.com/docs/)
