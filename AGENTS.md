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
npm run version:auto   # right after creating a work branch: makes its changelog fragment
npm run pr:check       # is this branch ready to merge? Run it before opening a PR
npm run flow:state     # branch, worktrees, open PRs: what the session-start hook prints
npm run release:plan   # what a release would hold, and what it is called
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

## Finding Code Without Reading Everything

Read `docs/MAP.md` before you grep. It maps each feature to its service,
repository and screens, lists the sections of the four files too large to read
whole, and names what to skip: `.claude/worktrees/` (copies of this repo, never
search it), `data/`, and the dated audit and review files in `docs/`. Open big
files by slice, not from the top.

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
4. After creating a work branch, run `npm run version:auto`. It makes `changelog.d/<branch>.md`; it does not
   touch any version. A work branch never edits `package.json`'s version, `app.json`'s version or `CHANGELOG.md`.

Before handoff:

1. Run `npm run pr:check`. It must say Ready to merge: a valid changelog fragment, the versions and `CHANGELOG.md` left alone, no conflict markers.
2. Read your fragment in `changelog.d/`. It has to describe what the branch actually changed, not a plan.
3. Run `npm test`.
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

## Several Chats At Once

Work happens in several chats at the same time, so the flow is built to let PRs be merged in any order.

- **Each chat works in its own git worktree**, not in the shared checkout: `git worktree add ../FitVen-<name> -b <type>/<name> origin/master`. Switching branches in a checkout another chat is using pulls the files out from under it.
- **A branch touches only its own files for the bookkeeping.** Its changelog entry is its own fragment in `changelog.d/`. It does not edit `CHANGELOG.md` or any version. The release commit folds the fragments in and sets the versions.
- **`npm run flow:state`** shows the branch, the worktrees and every open PR with its merge state; the session-start hook prints it. **`npm run pr:check`** says whether a branch is ready to merge, and CI runs the same check on every PR.
- **Ask the `git-steward` agent** (`.claude/agents/git-steward.md`) where to start a branch, whether two PRs will conflict and which goes first, whether a PR is ready, and what a release holds. It reads the real state and answers with commands; it advises and does not push or merge.
- Only the user says a PR may be merged, and CI must be green. Never `gh pr merge --admin`, never auto-merge, never merge on another chat's say-so. Stage files by explicit path.

## Versioning And Changelog

- Branch names are `major/...`, `minor/...`, `fix/...`, `breaking/...` (or `feat/...`), in lower case. The prefix decides what the branch counts as in the next release.
- A work branch has a changelog fragment, `changelog.d/<branch>.md`, and leaves `CHANGELOG.md` and every version alone. `changelog.d/README.md` explains the format.
- A release is its own small PR on a branch named `minor/release-<version>` (`release/...` is blocked by the ruleset): `npm run release:plan` says what it holds and what to call it, `npm run release:prepare -- <version>` folds the fragments into a dated entry, sets both versions and removes the fragments.
- If a release closes one version line and the next work should start the next minor line, use `npm run version:sync -- <nextMinor>.0`.
- See `docs/VERSIONING.md` for the full workflow, the order to merge in, and store tags.

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
- `npm test` also runs `scripts/check-imports.js`, which resolves every relative
  import with the exact casing on disk. Windows is case-insensitive and Android
  is not, so a wrong-case path works locally and fails only in a build.
- Do not add a second set of guides. `CLAUDE.md` is a pointer to `AGENTS.md`,
  never a copy.

## Automated PR Review

A pull request is read by eight review agents in parallel - quality
assurance, testing, security, architecture, code design, performance, UI
usability and design - and a ninth agent merges their reports into a single
comment on the PR. They run when asked, not by themselves: `gh workflow run
pr-review.yml --ref master -f pr=<number>` (a merged PR is read in its merge
commit), or `/qa` as a comment from someone with write access. The workflow is
`.github/workflows/pr-review.yml` and each agent's brief is a markdown file in
`.github/review-agents/`.

The agents read these guides. A rule written down here is a rule they will
enforce, which is one more reason to keep them true. To change what an agent
looks for, edit its brief, not the workflow. See
`.github/review-agents/README.md`.

## Local Guides

- `src/AGENTS.md`: source structure and layering
- `src/Pages/AGENTS.md`: UI and screen work
- `src/Database/AGENTS.md`: schema and data safety
- `src/Services/AGENTS.md`: the cloud sync field checklist
- `src/Sync/AGENTS.md`: which sync components actually run
- `modules/live-workout/AGENTS.md`: the lock-screen card during a workout - native code in `modules/` and `targets/`, and the rules JS, Swift and Kotlin share
