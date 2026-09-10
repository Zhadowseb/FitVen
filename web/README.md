# web/

Everything in this folder is served publicly. Nothing else in the repository is.

That is the whole reason it exists. The privacy policy has to be readable at a
public address — Google Play requires it, and so does art. 13 — while the rest
of the repository stays private. Pointing a static host at the repository root,
or at `docs/`, would publish the security review, the structure audit, the
performance audit and an export query along with it.

## What is here

- `privacy/index.html` — the public copy of the privacy policy.
- `delete-account/index.html` — how to delete an account without the app.
  Google Play links to it from the store page and requires it to load, to name
  the app, and to work for somebody who has already uninstalled — so no login
  and no form that needs one. Hand-written, unlike the policy page.
- `reset-password/index.html` — where the forgot-password email lands.
- `support/index.html` — the Support URL App Store Connect requires. Apple wants
  that address to lead to a page that actually offers support, and `/` here
  redirects to the policy, so it could not double as one. Same rules as the
  deletion page: no login, names the app, works for somebody who has already
  uninstalled. Hand-written.

`npm test` checks that the deletion page and the support page both name FitVen
and both carry the contact address the policy publishes. Three pages naming
three different addresses is the kind of thing a reviewer asks about, so the
policy is the single source and the others have to agree with it.

**`privacy/index.html` is generated — do not edit it.** It comes from
`src/Resources/Legal/privacyPolicy.js`,
which is the same file the in-app privacy screen reads, so the hosted page and
the app cannot say different things. After changing the policy:

```
npm run build:privacy-policy
```

`npm test` fails if the generated page has drifted from the app text.

## Publishing it

`netlify.toml` publishes this folder and nothing else. Netlify's free plan
deploys from a private repository, so connecting it means the live page follows
`master` on its own and cannot fall behind the app.

If it is hosted some other way — a second public repository with GitHub Pages,
a drag-and-drop upload, your own web space — then the copy that is live is not
covered by any check here. Re-upload it every time the policy changes, and treat
`PRIVACY_POLICY_VERSION` going up as the reminder.
