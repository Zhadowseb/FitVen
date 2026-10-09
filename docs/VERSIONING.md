# Versioning

## Who Owns Which Number

Two of them, and they have two different owners.

- **The version** (`1.1.6`) is what the store shows. It lives in
  `package.json > version` and `app.json > expo.version`, and the scripts here
  own it.
- **The build number** (`versionCode` on Android, `buildNumber` on iOS) is what
  the store uses to tell two uploads of the same version apart. **EAS owns it.**
  `eas.json` has `appVersionSource: "remote"`, so EAS keeps the counter on its
  own side and increments it for every production build. It is deliberately not
  in `app.json`.

They used to count separately, which is exactly as good as it sounds: `app.json`
reached 18 while EAS was at 24 for iOS and 49 for Android, and `app.json` was the
one being ignored. Do not add the fields back. To see the current numbers, use
`eas build:list`.

A build started with `expo run:android` outside EAS has no remote counter to ask
and gets whatever Expo defaults to. That is fine for a development build and is
not how anything is released.

## What Is In The Store

A tag per platform, on the commit that build came from:

```
ios/1.1.2       App Store, build 24
android/1.0.2   Google Play, build 49
```

Two tags rather than one, because the platforms are not on the same version.
Android trails iOS by three versions today, and a single `v1.1.2` would be a
claim about Play that is not true.

The daily `dev-metrics` Action (`.github/workflows/dev-metrics.yml`) reads
these tags for the developer overview: how long master has waited since the
newest tag per store, and which features are in a store build. A submission
without its tag reads as unreleased there.

**This is the branch point for a hotfix**, and it is the whole reason the tags
exist. `master` is where work is integrated, not what users have: it is
routinely several versions ahead, and none of that has been through review.
Branching a fix from `master` ships everything else with it.

```bash
git switch -c fix/whatever ios/1.1.2
```

Tag at the moment a build is submitted, not when a branch is merged. If you
forget, `eas build:list --json` carries `gitCommitHash` for every build, which
is how these two were recovered after the fact.

## Goals

- Let several chats work at the same time and still produce PRs that merge as they stand.
- Keep app versioning predictable: the version changes in one place, the release commit.
- Keep `package.json` and `app.json` aligned.
- Keep `CHANGELOG.md` stable: dated, versioned sections, written once.

## Branch Rules

A work branch is `<type>/<lower-case-name>`. The type is what the branch counts
as in the next release:

- `minor/...` or `minor-feature/...`, `fix/...`, `bugfix/...`, `hotfix/...`, `quickfix/...`: a patch
- `major/...` or `major-feature/...`, `feat/...`, `feature/...`: a minor
- `breaking/...`: a major
- `release/x.y.z`: exactly that version. The ruleset blocks new `release/**`
  branches, so the release commit goes on a branch named `minor/release-x.y.z`
  instead (see "Releasing").

A name that does not match fails `npm run pr:check` and the PR check in CI.

## Changelog Fragments

A branch does not edit `CHANGELOG.md`, and it does not set a version. Two
branches that did both conflicted on whichever merged second, because both
rewrote the same lines. A branch writes one file only it touches:
`changelog.d/<branch>.md` (`minor/more-exercises` is `minor-more-exercises.md`),
with `### Added`, `### Changed`, `### Fixed` or `### Removed` headings.
`changelog.d/README.md` has the format.

`npm run version:auto` right after making the branch creates it. It does not
write a version, and `npm run pr:check` fails if the fragment is missing, still
says `Describe the change here.`, or if the branch changed `package.json`'s
version, `app.json`'s version or `CHANGELOG.md`.

## Commands

```bash
npm run version:auto        # on a work branch: makes its changelog fragment
npm run version:status      # on a work branch: is the fragment there and finished?
npm run pr:check            # is this branch ready to merge?
npm run flow:state          # branch, worktrees, open PRs
npm run release:plan        # what a release would hold, and what it is called
npm run release:prepare -- 0.4.0 dry-run
npm run release:prepare -- 0.4.0
npm run release:android -- 0.4.0
npm run version:sync -- 0.4.0 skip-changelog
npm run branch:hooks:install
npm run branch:auto-push -- --dry-run
```

`npm run pr:check`

- Runs `scripts/git/flow.js check`, and CI runs the same on every PR (`.github/workflows/pr-hygiene.yml`).
- **Fails** on: a branch name that does not match; no changelog fragment, or one that is unfinished; a changed version or `CHANGELOG.md` on a work branch; leftover conflict markers.
- **Warns** about: being behind `master`, whitespace problems, uncommitted files, and every other open PR that changes the same files (with the ones that conflict called out: `package.json`, `app.json`, `README.md`, `AGENTS.md`, the migrations ledger, the big services).
- Also knows the release commit: a stable version in `package.json` makes it one, and then it wants both versions to agree, a dated entry for the version, and no fragment left.

`npm run release:prepare -- <version>`

- Updates `package.json > version` and `app.json > expo.version`.
- Turns `## [x.y.z] - Unreleased` into a dated entry, or makes one, and **folds every fragment in `changelog.d/` into it**, merged by heading, then deletes the fragments.
- Marks any older pending sections below that version as `Released with x.y.z`.

`npm run release:android -- <version>`

- Runs `npm run release:prepare -- <version>`, verifies EAS authentication (login session or `EXPO_TOKEN`), starts `eas build -p android --profile production`; `--prebuild` runs `expo prebuild` first.

`npm run branch:hooks:install` points Git at the committed `.githooks` and enables the `post-commit` hook that pushes work branches after a commit. `npm run branch:auto-push` is what it runs: it pushes the current work branch (`git push -u origin <branch>` the first time) and skips `master`, `main` and a detached HEAD.

## Several Chats At Once

Each chat works in **its own worktree**:

```bash
git fetch origin
git worktree add ../FitVen-<name> -b <type>/<name> origin/master
cd ../FitVen-<name>
npm ci            # or, with the same package-lock.json, a junction to the main checkout's node_modules
npm run version:auto
```

In the shared checkout, switching branches changes the files another chat has
open. Remove a worktree when its PR is merged: `git worktree remove ../FitVen-<name>`.
The Claude desktop app can make the worktree for a session itself.

Every chat is told where things stand when it starts: `.claude/settings.json`
runs `npm run flow:state` as a session-start hook, which prints the branch,
whether it is in a worktree, how far it is from `origin/master`, every open PR
with its merge state, and what to fix. Run it yourself any time.

For decisions - where to start, whether two PRs conflict, which goes first,
whether one is ready, what a release holds - ask the **`git-steward`** agent
(`.claude/agents/git-steward.md`). It reads this file and `AGENTS.md`, looks at
the real state, and answers with a verdict and the commands. It advises; it does
not push or merge.

## Making A PR That Can Be Merged As It Stands

1. Start from the current `origin/master`, in your own worktree.
2. `npm run version:auto`, then write the fragment as you go.
3. One piece of work per branch. Commit, and push (the hook does it where it is installed). Stage files by explicit path, never `git add -A`.
4. `npm run pr:check` and `npm test` pass. If `pr:check` names another open PR that changes the same files, say in the PR which goes first.
5. Open the PR with the template filled in: what and why, what was checked, what was **not** tried, and what has to be merged before or after it.
6. After it is open, CI has to be green. Look at it once per turn, not in a loop.

## Merging

- **Only the user says a PR may be merged**, and CI must be green. Never on another chat's say-so, never `gh pr merge --admin`, never auto-merge.
- Merge with a merge commit (`gh pr merge <n> --merge`), then cancel the review run the push triggers and run the review workflow for the PR by hand if it is wanted.
- **Order.** Independent PRs go in any order, which is the point of the fragments. PRs that change the same files (`pr:check` names them) go one after the other: merge the first, then in the second `git merge origin/master`, resolve, push, and let CI go green again. A migration PR whose SQL has to be run first goes before the PRs that need the change. A PR stacked on another goes after it.
- After a merge, `git pull` the main checkout and remove the worktree.

## Releasing

A release is its own small PR; it is not part of a feature PR.

1. Merge the PRs that should be in it.
2. On `master`, `npm run release:plan` lists the fragments and the version the branch names call for.
3. `git worktree add ../FitVen-release -b minor/release-<version> origin/master`, then `npm run release:prepare -- <version>`. That is the whole commit: both versions, the dated entry, the fragments gone. (`release/<version>` is blocked by the ruleset, which is why the name is not that.)
4. `npm run pr:check` (it knows the release commit), `npm test`, open the PR, merge it when the user says.
5. Build from the merge commit: `EAS_SKIP_AUTO_FINGERPRINT=1 npx eas build -p android|ios --profile production --non-interactive --no-wait`.
6. When a build has been submitted to a store, tag the commit it was built from: `git tag -a ios/<version> <sha> -m "iOS <version>, build <n>, in the App Store."` (`android/<version>` for Play), and push the tag. `eas build:list --json` carries `gitCommitHash`.

## Starting The Next Version Line

If a stable release closes one line and the next work should live in the next minor line, sync once explicitly:

```bash
npm run version:sync -- 0.6.0
```

After that, later fragments and releases continue from that line.

## Tidying

Remote branches of merged PRs and worktrees nobody uses pile up. The steward lists
them (`git branch -r --merged origin/master`, `git worktree list`) and proposes what to
remove; the deletion is the user's to approve, branch by branch.
