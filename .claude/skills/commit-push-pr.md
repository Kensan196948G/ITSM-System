# Commit, Push, and Create PR

Automatically commit changes, push to remote, and create a pull request.

## Usage

```
/commit-push-pr [commit message]
```

If no commit message is provided, you will be prompted for one.

## What this skill does

1. **Stage all changes**: Adds all modified and new files to git staging area
2. **Create commit**: Creates a commit with your message (includes Claude Code attribution)
3. **Push to remote**: Pushes the current branch to origin
4. **Create pull request**: Creates a PR from current branch to main using `gh` CLI

## Requirements

- Git repository initialized
- GitHub CLI (`gh`) installed and authenticated
- Current branch is not `main` or `master`

## Example

```bash
/commit-push-pr "Add new security dashboard features"
```

This will:
- Commit all changes with message: "Add new security dashboard features"
- Push to `origin/[current-branch]`
- Create a PR to `main` branch with auto-generated title and description

## Notes

- The PR body includes a summary of changes and test plan
- Automatically adds Claude Code attribution to commits
- If you're on `main` branch, you'll be prompted to create a new branch first
