// Login, register, the consent gate, and the auth errors a user reads.
// Keep in step with ../da/auth.js.
export default {
  createAccount: "Create account",
  fields: {
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "Enter password",
    showPassword: "Show password",
    hidePassword: "Hide password",
  },
  errors: {
    enterEmail: "Enter your email address.",
    enterPassword: "Enter your password.",
    enterEmailFirst: "Enter your email address first.",
    signInToDeleteAccount: "You need to be signed in to delete your account.",
    couldNotDeleteAccount: "Could not delete the account.",
  },
  login: {
    title: "Login",
    subtitle: "Sign in to load your programs and workouts.",
    submit: "Login",
    signingIn: "Signing in...",
    couldNotSignIn: "Could not sign in.",
    forgotPassword: "Forgot password?",
    sending: "Sending...",
    enterEmailThenTapAgain: "Enter your email address, then tap this again.",
    resetLinkSent:
      "If that address has an account, a link to set a new password is on its way. It expires, and it only works once.",
    couldNotSendEmail: "Could not send the email. Try again.",
    newHere: "New here?",
  },
  register: {
    subtitle: "An account syncs your programs and workouts across devices.",
    username: "Username",
    usernamePlaceholder: "your_name",
    usernamePreviewExample: "your_name#1234",
    usernameHint:
      "FitVen adds a 4-digit tag, so it shows up as {preview}. The tag cannot be changed later.",
    passwordMinLength: {
      one: "At least {count} character.",
      other: "At least {count} characters.",
    },
    repeatPassword: "Repeat password",
    // App Store compliance: the summary beside the checkbox must say, in so
    // many words, that there is no tolerance for objectionable content or
    // abusive users. scripts/test-terms-of-use.js checks this text.
    termsCheckbox: "I agree to the terms of use.",
    termsCheckboxAccessibility: "I agree to the terms of use",
    termsSummary:
      "There is no tolerance for objectionable content or abusive behaviour. Break that and the account goes.",
    readFullTerms: "Read the full terms of use",
    howDataIsHandled: "How FitVen handles your data",
    creating: "Creating account...",
    errors: {
      pickUsername: "Pick a username.",
      usernameRules: "Use 3-20 lowercase letters, numbers or underscores.",
      choosePassword: "Choose a password.",
      repeatPassword: "Type the password again.",
      passwordsDiffer: "The two passwords are not the same.",
      acceptTerms: "You have to accept the terms to create an account.",
      couldNotCreate: "Could not create account.",
    },
    done: {
      confirmEmailTitle: "Confirm your email",
      confirmEmailBody:
        "We sent a link to {email}. Open it to confirm the address, then sign in.",
      accountCreatedTitle: "Account created",
      accountCreatedBody: "Your account is ready. Sign in to start.",
      goToLogin: "Go to login",
    },
  },
  consent: {
    title: "Before you continue",
    body:
      "Two things to agree to. The terms of use set out what is and is not allowed on FitVen — there is no tolerance for objectionable content or abusive behaviour. The privacy policy covers your data: FitVen stores your training, and through sickness entries, heart rate and tracked runs, health data about you, which European law needs your explicit permission for. Read both and tap Accept to carry on, or close the app if you would rather not.",
    termsHeading: "Terms of use",
    privacyHeading: "Privacy policy",
    accept: "Accept both and continue",
    saving: "Saving...",
    couldNotSave: "Could not save your answer. Try again.",
  },
};
