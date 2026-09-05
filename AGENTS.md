# AGENTS.md

## Scope

This file applies to the whole repository.
Keep the root guide short and place domain-specific rules in closer `AGENTS.md` files.

## Project Snapshot

- `programapp` is an Expo / React Native application (Android and iOS).
- Main application code lives in `src/`.
- Data lives in a per-user local SQLite database **and** syncs to Supabase.
  This is not an offline-only app: every data change has a cloud side.
- Use `package.json` scripts as the source of truth for local commands.

## Commands

```
npm run start          # Expo dev client
npm run android        # native run
npm test               # every check, including the doc drift check
npm run version:auto   # right after creating a work branch
npm run version:status # verify the branch/version state
```

There is no linter and no type checking. `npm test` covers a handful of
isolated helpers plus the doc drift check, so changes to services,
repositories and screens cannot be verified automatically. Read the code.

## The Layers

```
Pages ──▶ Services ──▶ Repository ──▶ Database (SQLite)
  │           └──────▶ Supabase (cloud)
  └──▶ Resources, Utils, Contexts
```

Screens call services. Services call repositories. Repositories write SQL.
The one deliberate exception is auth: Login, Register and Profile reach
`Services/authService`, which is the only thing that touches
`Database/supaBaseClient` for sign-in.

## What Most Often Goes Wrong Here

1. **A new database field has to be remembered in 8 to 11 places across four
   layers.** Skip the cloud half and the field works on one phone and vanishes
   on the next. The checklist is in `src/Services/AGENTS.md`.
2. **The schema lives in two files.** `src/Database/schema/*.js` is the truth
   for a fresh install, `src/Database/db.js` for an existing one. Both have to
   change, and they have to end up in the same place.
3. **Colours must never sit in a `*Style.js`.** `applyAccentTheme()` mutates
   the `Colors` object in place, and `StyleSheet.create` runs once at import.
   See `src/Pages/AGENTS.md`.
4. **Never alias one layer to another layer's name.** 45 function names exist
   in both `Services` and `Repository` with the same signature, so
   `import { xService as xRepository }` sends the next reader to the wrong
   file. `npm test` fails if one reappears.
5. **`src/Sync/` only runs what `App.js` mounts.** See `src/Sync/AGENTS.md`.

## Global Working Rules

- Prefer small, focused changes over large refactors.
- Follow nearby patterns before introducing new abstractions.
- Avoid changing unrelated files in the same task.
- Never edit code directly on `master` or `main`.
- If the user asks for code changes while on `master` or `main`, stop first and propose a branch name before making changes.
- Review local changes before switching branches or rewriting Git history.

## Mandatory Preflight

Before editing any file:

1. Run `git branch --show-current` and `git status --short`.
2. Confirm the current branch clearly matches the requested work. If it does not, stop and propose a concrete branch name before editing.
3. Review existing local changes before switching branches.
4. After creating or switching to a work branch, run `npm run version:auto` before making further version edits.

Before handoff:

1. Run `npm run version:status`.
2. Verify that the changelog contains the current branch version and describes the actual changes. Read only the top: `sed -n '1,60p' CHANGELOG.md`. The current version is always first, and the rest is history you do not need.
3. Run `npm test` and inspect `git diff --check`.
4. Report the current branch, validation results, and any uncommitted or unpushed changes explicitly.

## GitHub Issue Fixes

- When the user asks the agent to review GitHub issues and solve them, only inspect, evaluate, or implement code for issues labeled `codex-fix` or `codex-fix-human-input`.
- For issues labeled `codex-fix`, proceed with the fix without asking for confirmation first.
- For issues labeled `codex-fix-human-input`, always ask before implementing and describe the intended implementation.
- Do not inspect, evaluate, or act on issues with other labels unless the user explicitly asks for those issues.
- After implementing an issue fix, add a GitHub issue comment describing what changed before adding any completion label.
- After commenting, add the `codex-fixed` label to show the user that the issue is ready for review and can be closed manually from GitHub.
- Do not close GitHub issues automatically unless the user explicitly asks for that.

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

## Keeping These Guides True

These files are only worth reading if they are correct, and the fastest way to
make them worthless is to change the code and leave them behind.

- If a change makes a sentence in any `AGENTS.md`, `CLAUDE.md` or `README.md`
  wrong, fix the sentence in the same commit. That includes deleting a rule
  once the thing it warns about is gone.
- `npm test` runs `scripts/check-agent-docs.js`, which fails when a path named
  in a guide no longer exists, when a documented npm script is missing, or when
  one of the invariants the guides promise stops holding. It cannot check
  prose, so it is a floor, not a substitute for reading.
- Do not add a second set of guides. `CLAUDE.md` is a pointer to `AGENTS.md`,
  never a copy.

## Local Guides

- `src/AGENTS.md`: source structure and layering
- `src/Pages/AGENTS.md`: UI and screen work
- `src/Database/AGENTS.md`: schema and data safety
- `src/Services/AGENTS.md`: the cloud sync field checklist
- `src/Sync/AGENTS.md`: which sync components actually run
