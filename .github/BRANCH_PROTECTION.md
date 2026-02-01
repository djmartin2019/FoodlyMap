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
  - ✅ Require review from Code Owners: (optional)

- ✅ **Require status checks to pass before merging**
  - ✅ Require branches to be up to date before merging
  - ✅ Status checks found in the last week for this repository:
    - Select: `lint-test-build` (from CI workflow)

- ✅ **Require conversation resolution before merging** (optional but recommended)

- ✅ **Do not allow bypassing the above settings** (recommended for solo maintainer too)

### Optional but Recommended

- ✅ **Require linear history** (keeps git history clean)
- ✅ **Include administrators** (applies rules to everyone, including you)

## What This Does

- **Prevents direct pushes to `main`** - All changes must go through PRs
- **Blocks merges if CI fails** - Ensures lint/typecheck/test/build pass
- **Requires up-to-date branches** - Prevents merge conflicts
- **Optional review requirement** - Even solo maintainers benefit from self-review

## Solo Maintainer Tips

- You can still merge your own PRs (no approval needed if you disable that requirement)
- CI will still run and block bad code
- This creates a paper trail of changes
- Makes it easier to rollback if needed

## Testing the Setup

1. Create a test branch: `git checkout -b test-branch-protection`
2. Make a small change and commit
3. Push and create a PR
4. Try to merge - it should require CI to pass
5. Delete the test branch after confirming it works
