import { StatusBar } from "expo-status-bar";
import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useState } from "react";
import { useNavigation } from "@react-navigation/native";

import styles from "./RegisterPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { authService } from "../../Services";
import Checkmark from "../../Resources/Icons/UI-icons/Checkmark";
import Cross from "../../Resources/Icons/UI-icons/Cross";
import Eye from "../../Resources/Icons/UI-icons/Eye";
import {
  buildFullUsername,
  isValidUsernameBase,
  normalizeUsernameBaseInput,
} from "../../Utils/socialUsername";
import {
  ThemedButton,
  ThemedCard,
  ThemedHeader,
  ThemedKeyboardProtection,
  ThemedText,
  ThemedTextInput,
  ThemedTitle,
  ThemedView,
} from "../../Resources/ThemedComponents";

const MINIMUM_PASSWORD_LENGTH = 6;

export default function RegisterPage() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const navigation = useNavigation();
  const [usernameBase, setUsernameBase] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [createdAccount, setCreatedAccount] = useState(null);
  const [submitState, setSubmitState] = useState({
    status: "idle",
    message: "",
  });
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const normalizedUsername = normalizeUsernameBaseInput(usernameBase);
  const usernamePreview =
    normalizedUsername && isValidUsernameBase(normalizedUsername)
      ? buildFullUsername(normalizedUsername, "1234")
      : "your_name#1234";
  const isRegistering = submitState.status === "loading";

  const clearErrors = () => {
    setFieldErrors({});

    if (submitState.status === "error") {
      setSubmitState({ status: "idle", message: "" });
    }
  };

  // Checked on press rather than by greying the button out. The same reasoning
  // as the login screen: a button at 40% opacity with nothing saying why reads
  // as broken, and it never says which of the four rules it is waiting for.
  const findFieldErrors = (normalizedEmail) => {
    const errors = {};

    if (!normalizedUsername) {
      errors.username = "Pick a username.";
    } else if (!isValidUsernameBase(normalizedUsername)) {
      errors.username =
        "Use 3-20 lowercase letters, numbers or underscores.";
    }

    if (!normalizedEmail) {
      errors.email = "Enter your email address.";
    }

    if (!password) {
      errors.password = "Choose a password.";
    } else if (password.length < MINIMUM_PASSWORD_LENGTH) {
      errors.password = `At least ${MINIMUM_PASSWORD_LENGTH} characters.`;
    }

    if (!retypePassword) {
      errors.retypePassword = "Type the password again.";
    } else if (password !== retypePassword) {
      errors.retypePassword = "The two passwords are not the same.";
    }

    return errors;
  };

  const handleRegister = async () => {
    if (isRegistering) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const nextFieldErrors = findFieldErrors(normalizedEmail);

    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0) {
      setSubmitState({ status: "idle", message: "" });
      return;
    }

    setSubmitState({ status: "loading", message: "" });

    try {
      const result = await authService.register({
        email: normalizedEmail,
        password,
        usernameBase: normalizedUsername,
      });

      // A session comes back only if the project confirms addresses
      // automatically. It does not today, so this lands on the panel below
      // rather than signing anybody in - but if that setting is ever turned on,
      // the auth change unmounts this screen and the panel is never seen.
      setCreatedAccount({
        email: normalizedEmail,
        needsEmailConfirmation: !result.session,
      });
      setSubmitState({ status: "idle", message: "" });
    } catch (error) {
      setSubmitState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Could not create account.",
      });
    }
  };

  const goToLogin = () => navigation.navigate("LoginPage");

  return (
    <ThemedView style={styles.container}>
      {/* The bar used to be a back arrow alone in an empty band. */}
      <ThemedHeader>
        <ThemedTitle type="h3" numberOfLines={1}>
          Create account
        </ThemedTitle>
      </ThemedHeader>

      <View
        pointerEvents="none"
        style={[
          styles.heroAccentPrimary,
          { backgroundColor: theme.secondary ?? theme.primary },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.heroAccentSecondary,
          { backgroundColor: theme.primary ?? theme.iconColor },
        ]}
      />

      <View style={styles.content}>
        <ThemedKeyboardProtection scroll contentContainerStyle={styles.scrollContent}>
          {createdAccount ? (
            // Creating the account used to end here: a line of text, an emptied
            // form, and no way onwards from the screen you had just finished
            // with.
            <ThemedCard
              style={[
                styles.registerCard,
                {
                  backgroundColor: cardSurface,
                  borderColor: cardBorder,
                },
              ]}
            >
              <View style={styles.doneIconRow}>
                <Checkmark width={22} height={22} color={theme.secondary} />
              </View>

              <ThemedText style={styles.doneTitle} setColor={titleColor}>
                {createdAccount.needsEmailConfirmation
                  ? "Confirm your email"
                  : "Account created"}
              </ThemedText>

              <ThemedText style={styles.doneBody} setColor={quietText}>
                {createdAccount.needsEmailConfirmation
                  ? `We sent a link to ${createdAccount.email}. Open it to confirm the address, then sign in.`
                  : "Your account is ready. Sign in to start."}
              </ThemedText>

              <ThemedButton
                title="Go to login"
                onPress={goToLogin}
                fullWidth
                style={[styles.primaryButton, styles.doneButton]}
              />
            </ThemedCard>
          ) : (
            <>
              <View style={styles.heroBlock}>
                <ThemedText style={styles.eyebrow} setColor={quietText}>
                  FitVen
                </ThemedText>
                <ThemedText style={styles.subtitle} setColor={quietText}>
                  An account syncs your programs and workouts across devices.
                </ThemedText>
              </View>

              <ThemedCard
                style={[
                  styles.registerCard,
                  {
                    backgroundColor: cardSurface,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <View style={styles.formSection}>
                  <ThemedText style={styles.inputLabel} setColor={titleColor}>
                    Username
                  </ThemedText>
                  <ThemedTextInput
                    value={usernameBase}
                    onChangeText={(next) => {
                      setUsernameBase(next);
                      clearErrors();
                    }}
                    placeholder="your_name"
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={fieldErrors.username}
                    style={styles.inputWrapper}
                  />
                  {fieldErrors.username ? null : (
                    <ThemedText style={styles.fieldHint} setColor={quietText}>
                      FitVen adds a 4-digit tag, so it shows up as{" "}
                      {usernamePreview}. The tag cannot be changed later.
                    </ThemedText>
                  )}
                </View>

                <View style={styles.formSection}>
                  <ThemedText style={styles.inputLabel} setColor={titleColor}>
                    Email
                  </ThemedText>
                  <ThemedTextInput
                    value={email}
                    onChangeText={(next) => {
                      setEmail(next);
                      clearErrors();
                    }}
                    placeholder="you@example.com"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    error={fieldErrors.email}
                    style={styles.inputWrapper}
                  />
                </View>

                <View style={styles.formSection}>
                  <ThemedText style={styles.inputLabel} setColor={titleColor}>
                    Password
                  </ThemedText>
                  <ThemedTextInput
                    value={password}
                    onChangeText={(next) => {
                      setPassword(next);
                      clearErrors();
                    }}
                    placeholder="Enter password"
                    secureTextEntry={!isPasswordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={fieldErrors.password}
                    style={styles.inputWrapper}
                    action={{
                      label: isPasswordVisible
                        ? "Hide password"
                        : "Show password",
                      onPress: () => setIsPasswordVisible((shown) => !shown),
                      icon: (
                        <Eye
                          width={20}
                          height={20}
                          color={
                            isPasswordVisible ? theme.primary : theme.iconColor
                          }
                        />
                      ),
                    }}
                  />
                  {/* The rule, before it is broken rather than after. */}
                  {fieldErrors.password ? null : (
                    <ThemedText style={styles.fieldHint} setColor={quietText}>
                      At least {MINIMUM_PASSWORD_LENGTH} characters.
                    </ThemedText>
                  )}
                </View>

                <View style={styles.formSection}>
                  <ThemedText style={styles.inputLabel} setColor={titleColor}>
                    Repeat password
                  </ThemedText>
                  <ThemedTextInput
                    value={retypePassword}
                    onChangeText={(next) => {
                      setRetypePassword(next);
                      clearErrors();
                    }}
                    placeholder="Repeat password"
                    secureTextEntry={!isPasswordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={fieldErrors.retypePassword}
                    style={styles.inputWrapper}
                  />
                </View>
              </ThemedCard>

              <View style={styles.actions}>
                <ThemedButton
                  title={isRegistering ? "Creating account..." : "Create account"}
                  onPress={handleRegister}
                  fullWidth
                  style={styles.primaryButton}
                  disabled={isRegistering}
                />

                {submitState.status === "error" && submitState.message ? (
                  <View style={styles.errorRow}>
                    <Cross width={15} height={15} color={theme.danger} />
                    <ThemedText style={styles.errorText} setColor={theme.danger}>
                      {submitState.message}
                    </ThemedText>
                  </View>
                ) : null}

                {/* Art. 13: readable before an email address is handed over, not
                    only after. Consent itself is taken on first sign-in, where
                    there is a profile row to record it against. */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  accessibilityRole="link"
                  onPress={() => navigation.navigate("PrivacyPolicyPage")}
                  style={styles.privacyLink}
                >
                  <ThemedText
                    style={styles.privacyLinkText}
                    setColor={quietText}
                  >
                    How FitVen handles your data
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ThemedKeyboardProtection>
      </View>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
