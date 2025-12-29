# Commit, Push, Create PR, and Auto-Merge

Automatically commit changes, push to remote, create a pull request, and merge it immediately.

## Usage

```
/commit-push-pr-merge [commit message]
```

If no commit message is provided, you will be prompted for one.

## What this skill does

1. **Stage all changes**: Adds all modified and new files to git staging area
2. **Create commit**: Creates a commit with your message (includes Claude Code attribution)
3. **Push to remote**: Pushes the current branch to origin
4. **Create pull request**: Creates a PR from current branch to main
5. **Auto-merge PR**: Automatically merges the PR after creation (squash merge)
6. **Switch back to main**: Checks out main branch and pulls latest changes
7. **Clean up**: Deletes the feature branch (optional)

## Requirements

- Git repository initialized
- GitHub CLI (`gh`) installed and authenticated
- Current branch is not `main` or `master`
- No merge conflicts
- All CI checks must pass (if configured)

## Example

```bash
/commit-push-pr-merge "Fix: Resolve database migration issues"
```

This will:
- Commit all changes with message: "Fix: Resolve database migration issues"
- Push to `origin/[current-branch]`
- Create a PR to `main` branch
- **Automatically merge the PR**
- Switch back to `main` branch
- Pull latest changes

## Warning

⚠️ **Use with caution**: This command will immediately merge your changes to main branch. Make sure:
- Your changes are tested and working
- You have reviewed the changes
- CI/CD pipeline is passing (if configured)

## Notes

- Uses squash merge by default
- PR body includes auto-generated summary and test plan
- Adds Claude Code attribution to commits
- If merge fails, you'll need to resolve conflicts manually
- If you're on `main` branch, you'll be prompted to create a new branch first

## Difference from `/commit-push-pr`

| Feature | `/commit-push-pr` | `/commit-push-pr-merge` |
|---------|------------------|------------------------|
| Create commit | ✅ | ✅ |
| Push to remote | ✅ | ✅ |
| Create PR | ✅ | ✅ |
| Auto-merge PR | ❌ | ✅ |
| Switch to main | ❌ | ✅ |
| Delete feature branch | ❌ | ✅ (optional) |
