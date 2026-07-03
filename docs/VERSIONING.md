# Versioning

## Goals

- Keep app versioning predictable across branches.
- Keep `package.json` and `app.json` aligned.
- Reserve build number increments for real releases.
- Keep `CHANGELOG.md` stable with versioned sections, where pending versions use an `Unreleased` tag until they ship.
- Make versioning mostly automatic from the active branch.
- Derive prerelease bumps from the committed base version of the current work branch.

## Branch Rules

- `minor/...` or `minor-feature/...`: next `patch` prerelease
- `fix/...`, `bugfix/...`, `hotfix/...`, `quickfix/...`: next `patch` prerelease
- `major/...` or `major-feature/...`: next `minor` prerelease
- `feat/...` or `feature/...`: next `minor` prerelease as a supported alias for `major/...`
- `breaking/...`: next `major` prerelease
- `release/x.y.z`: exact stable release version

Examples:

- `major/program-calendar` from stable `0.3.1` becomes `0.4.0-major-program-calendar.1`
- `minor/program-sync` from committed `0.5.0` becomes `0.5.1-minor-program-sync.1`
- `fix/set-counter` from committed `0.5.1` becomes `0.5.2-fix-set-counter.1`
- `breaking/schema-reset` from stable `0.5.2` becomes `1.0.0-breaking-schema-reset.1`
- `release/0.4.0` becomes `0.4.0`

If a branch name does not match the convention, use:

```bash
npm run version:branch -- minor
```

If you rename a work branch after it has already been versioned, or you want to recalculate from a specific committed base, rerun the command with `--base-ref <ref>`.

## Commands

```bash
npm run version:status
npm run version:auto
npm run version:auto -- --base-ref master
npm run version:branch
npm run version:branch -- patch
npm run version:branch -- --base-ref master
npm run version:branch -- minor/example dry-run
npm run branch:hooks:install
npm run branch:auto-push -- --dry-run
npm run release:prepare -- 0.4.0 dry-run
npm run release:android -- 0.4.0
npm run version:sync -- 0.4.0 skip-changelog
```

## What Each Command Updates

`npm run version:status`

- Shows current branch
- Shows `package.json` and `app.json` versions
- Tells whether versions are aligned
- Tells what command to run next

`npm run version:auto`

- Reads the current branch name
- Uses branch rules automatically
- Uses committed `HEAD` as the default base ref, so running it right after branching derives the next prerelease from the branch base commit
- Runs branch prerelease logic on `major/...`, `minor/...`, `fix/...`, and compatible aliases like `feat/...`
- Runs release logic on `release/x.y.z`
- Refuses to work on `master` and `main`

`npm run version:branch`

- Updates `package.json > version`
- Updates `app.json > expo.version`
- Ensures `CHANGELOG.md` contains a section like `## [x.y.z] - Unreleased` for the branch's stable target version
- Uses committed `HEAD` as the default base ref unless `--base-ref <ref>` is supplied
- Does not increment `android.versionCode`
- Does not increment `ios.buildNumber`

`npm run release:prepare -- <version>`

- Updates `package.json > version`
- Updates `app.json > expo.version`
- Increments `app.json > expo.android.versionCode`
- Sets `app.json > expo.ios.buildNumber` to the same incremented build number
- Converts `## [x.y.z] - Unreleased` into a dated release entry in `CHANGELOG.md`
- Marks any older pending sections below that version as `Released with x.y.z`

`npm run release:android -- <version>`

- Runs `npm run release:prepare -- <version>`
- Verifies EAS authentication using the current login session or `EXPO_TOKEN`
- Starts `eas build -p android --profile production`
- Optionally runs `expo prebuild` first when called with `--prebuild`

`npm run branch:hooks:install`

- Points Git at the repo's committed `.githooks` directory.
- Enables the `post-commit` hook that pushes work branches after successful commits.

`npm run branch:auto-push`

- Pushes the current work branch to its upstream.
- If the branch has no upstream yet, runs `git push -u origin <branch>`.
- Skips `master`, `main`, and detached HEAD.

## Recommended Workflow

1. Create a branch with a meaningful prefix like `major/...`, `minor/...`, `fix/...`, or `release/x.y.z`.
2. Run `npm run version:auto` immediately after branching.
3. Use `npm run version:status` whenever you want to verify the current state.
4. Do the work.
5. Commit normally. In clones with `npm run branch:hooks:install` applied, the commit hook pushes the branch automatically.
6. Replace the placeholder text in `CHANGELOG.md` before shipping.
7. For a stable release branch, run `npm run release:prepare -- x.y.z` or `npm run release:android -- x.y.z`.

## Starting The Next Version Line

If a stable release closes one line and you want the next work to live in the next minor line, sync the first follow-up branch explicitly before continuing normal branch versioning.

Example:

```bash
npm run version:sync -- 0.6.0
```

After that first reset, later stacked branches can continue normally from that new `0.6.x` base.

## Codex Workflow

- If you ask for code changes while the repo is on `master` or `main`, Codex should first propose a branch name and wait before editing.
- When you move on to a new request after being satisfied with the previous one, Codex should suggest committing the finished work before starting the next task.
- When Codex creates or switches to a work branch, it should run `npm run version:auto` so you do not have to think about versioning manually.
- After Codex commits on a work branch, it should push immediately. The post-commit hook handles this when installed; otherwise Codex should run `git push` or `git push -u origin <branch>` manually.
