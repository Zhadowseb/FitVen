# AGENTS.md

## Scope

This file applies to the whole repository.
Keep the root guide short and place domain-specific rules in closer `AGENTS.md` files.

## Project Snapshot

- `programapp` is an Expo / React Native application.
- Main application code lives in `src/`.
- Use `package.json` scripts as the source of truth for local commands.

## Global Working Rules

- Prefer small, focused changes over large refactors.
- Follow nearby patterns before introducing new abstractions.
- Avoid changing unrelated files in the same task.
- Never edit code directly on `master` or `main`.
- If the user asks for code changes while on `master` or `main`, stop first and propose a branch name before making changes.
- Review local changes before switching branches or rewriting Git history.

## Branch And Commit Discipline

- Treat a new feature, fix, refactor, or unrelated request as a new unit of work.
- Before starting a new unit of work, check whether the current branch and uncommitted changes belong to the previous task.
- If the user appears satisfied with the current work and then asks for something new, suggest committing the finished work before starting the next change.
- Before switching to a new work branch, make sure the finished branch is committed and pushed if its state should stay visible on GitHub.
- After every successful commit on a work branch, push the branch immediately. Use the existing upstream when present; otherwise use `git push -u origin <branch>`.
- The repo's `.githooks/post-commit` hook automates commit pushes in configured clones. If the hook is unavailable, push manually after committing.
- If the current branch name no longer matches the requested work, suggest creating a new branch before editing files.
- When suggesting a branch, propose a concrete branch name instead of asking an open-ended question.

## Versioning And Changelog

- After creating or switching to a work branch, use `npm run version:auto` before making further version edits so the branch version is derived from its base commit.
- Use `npm run version:status` whenever you need to verify the current branch/version state.
- Prefer branch names like `major/...`, `minor/...`, `fix/...`, or `release/x.y.z`.
- Use `npm run release:prepare -- <version>` for stable releases.
- If a release closes one version line and the next work should start the next minor line, use `npm run version:sync -- <nextMinor>.0` on the first follow-up branch before continuing normal branch versioning.
- See `docs/VERSIONING.md` for the full workflow and branch rules.

## Local Guides

- `src/AGENTS.md`: source structure and layering
- `src/Pages/AGENTS.md`: UI and screen work
- `src/Database/AGENTS.md`: schema and data safety
