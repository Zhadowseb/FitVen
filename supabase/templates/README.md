# Auth email templates

The emails Supabase sends: confirm your address, reset your password. They live
here because the dashboard is the only other copy, and a dashboard has no
history, no review and nothing to recover from.

**These files are not applied automatically.** Paste them into Supabase under
Authentication → Emails, one per template. Change them here first, so the repo
stays the record of what was pasted.

| File | Supabase template | Used by |
|---|---|---|
| `confirm-signup.html` | Confirm signup | Every new account — the project does not auto-confirm addresses |
| `reset-password.html` | Reset Password | Forgot password on the login screen |
| `magic-link.html` | Magic Link | Nothing in the app. Kept so the fallback is not Treesy-branded |
| `change-email.html` | Change Email Address | Nothing in the app yet |

## The two mistakes that were in here

Both were in the Reset Password template, and both are worth knowing about
because neither fails in a way that points at itself.

**A stray quote.** The link read `<a href="{{ .RedirectTo }}"">`. Supabase
renders these with Go's `html/template`, which parses the HTML to decide how to
escape each value and returns an error when it cannot tell where an attribute
ends. The whole send then fails with `500 unexpected_failure` and the message
"Error sending recovery email" — which reads like a mail server problem and is
not one. Malformed HTML in a template is a broken template, not a cosmetic
issue.

**The wrong variable.** `{{ .RedirectTo }}` is the bare destination. The link
that carries the recovery token, and redirects onward after spending it, is
`{{ .ConfirmationURL }}`. Built from `.RedirectTo`, the email would have led to
a page with no session, which would have told the user their link had expired.

## Sender

Sender name and address are in Authentication → SMTP Settings, not here. They
have to say FitVen. A password reset arriving from another company's name is
what phishing looks like, and spam filters agree.
