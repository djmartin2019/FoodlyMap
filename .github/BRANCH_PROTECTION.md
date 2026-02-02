# Branch Protection Setup Guide

This guide helps you enable branch protection for the `main` branch to ensure code quality and prevent direct pushes.

## Quick Setup (5 minutes)

1. Go to your repository on GitHub
2. Navigate to: **Settings** → **Branches**
3. Click **Add rule** (or edit existing rule for `main`)
4. Configure the following:

### Required Settings

**Branch name pattern:** `main`

**Protect matching branches:**
- ✅ **Require a pull request before merging**
  - ✅ Require approvals: `1` (optional but recommended)
  - ✅ Dismiss stale pull request approvals when new commits are pushed

- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - ✅ **Status checks found in the last week for this repository:**
    - ✅ Select: **`ci`** (from CI workflow)
    - ❌ Do NOT select: `lint`, `test`, `build`, or any other individual checks
    - ❌ Do NOT select: `security` or any security workflow checks

- ✅ **Require conversation resolution before merging** (optional but recommended)

- ✅ **Do not allow bypassing the above settings** (recommended)

### Optional but Recommended

- ✅ **Require linear history** (keeps git history clean)
- ✅ **Include administrators** (applies rules to everyone)

## Important Notes

- **Only require `ci` check** - This single check runs lint, typecheck, test, and build in sequence
- **Security workflows are informational** - They run on schedule and don't block merges
- **Cloudflare Pages handles deployments** - No deployment workflows needed in GitHub Actions

## What This Does

- **Prevents direct pushes to `main`** - All changes must go through PRs
- **Blocks merges if CI fails** - Ensures lint/typecheck/test/build pass
- **Requires up-to-date branches** - Prevents merge conflicts
- **Single stable check** - One required check named `ci` that's easy to manage

## Testing the Setup

1. Create a test branch: `git checkout -b test-branch-protection`
2. Make a small change and commit
3. Push and create a PR
4. Try to merge - it should require the `ci` check to pass
5. Delete the test branch after confirming it works
