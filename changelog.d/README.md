# changelog.d

One small file per branch, folded into `CHANGELOG.md` by the release command.

**Why.** Every branch used to edit the same lines of `CHANGELOG.md` and the
version in `package.json` and `app.json`, so two branches open at once
conflicted on whichever merged second. A fragment is a file only its own branch
touches, so branches merge in any order. `CHANGELOG.md` and the versions change
in one place: the release commit.

**What to do.**

1. `npm run version:auto` right after making a branch creates
   `changelog.d/<branch>.md` (`minor/more-exercises` becomes
   `minor-more-exercises.md`).
2. Write what changed, in the same `###` headings `CHANGELOG.md` uses:

   ```
   ### Added
   - **What a person sees or what is now possible,** in a sentence, and why.

   ### Fixed
   - **The thing that was wrong.** The cause, if it was not obvious.
   ```

   Headings are `Added`, `Changed`, `Fixed`, `Removed`; the entries are what you
   would want to read in six months. No text before the first heading, and no
   `Describe the change here.` left.
3. Commit it with the work. `npm run pr:check` says whether the branch is ready.
4. Do not touch `CHANGELOG.md`, `package.json`'s version or `app.json`'s version.

**At release,** `npm run release:prepare -- <version>` merges every fragment by
heading into a dated entry in `CHANGELOG.md`, sets both versions, and deletes
the fragments. `npm run release:plan` shows what a release would hold and which
version the branch names call for. See `docs/VERSIONING.md`.
