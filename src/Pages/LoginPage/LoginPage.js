import { StatusBar } from "expo-status-bar";
import { Pressable, View, useColorScheme } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";

import styles from "./LoginPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { authService } from "../../Services";
import Checkmark from "../../Resources/Icons/UI-icons/Checkmark";
import Cross from "../../Resources/Icons/UI-icons/Cross";
import Eye from "../../Resources/Icons/UI-icons/Eye";
import {
  ThemedButton,
  ThemedCard,
  ThemedKeyboardProtection,
  ThemedText,
  ThemedTextInput,
  ThemedView,
} from "../../Resources/ThemedComponents";

export default function LoginPage() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [submitState, setSubmitState] = useState({
    status: "idle",
    message: "",
  });
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const isSigningIn = submitState.status === "loading";

  const clearErrors = () => {
    setFieldErrors({});

    if (submitState.status === "error") {
      setSubmitState({ status: "idle", message: "" });
    }
  };

  // The button stays enabled and this runs on press. Greying it out until both
  // fields are filled reads as "broken", not as "not yet" - and it never says
  // which field it is waiting for.
  const findFieldErrors = (normalizedEmail) => {
    const errors = {};

    if (!normalizedEmail) {
      errors.email = "Enter your email address.";
    }

    if (!password) {
      errors.password = "Enter your password.";
    }

    return errors;
  };

  // Deliberately says the same thing whether or not the address has an
  // account. Anything else turns this screen into a way to ask which email
  // addresses are registered.
  const handleForgotPassword = async () => {
    if (isSendingReset) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setFieldErrors({
        email: "Enter your email address, then tap this again.",
      });
      setSubmitState({ status: "idle", message: "" });
      return;
    }

    setFieldErrors({});
    setIsSendingReset(true);

    try {
      await authService.requestPasswordReset({ email: normalizedEmail });
      setSubmitState({
        status: "sent",
        message:
          "If that address has an account, a link to set a new password is on its way. It expires, and it only works once.",
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not send the email. Try again.",
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleLogin = async () => {
    if (isSigningIn) {
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const nextFieldErrors = findFieldErrors(normalizedEmail);

    setFieldErrors(nextFieldErrors);

    if (Object.keys(nextFieldErrors).length > 0) {
      setSubmitState({ status: "idle", message: "" });
      return;
    }

    setSubmitState({
      status: "loading",
      message: "",
    });

    try {
      await authService.login({
        email: normalizedEmail,
        password,
      });

      // Nothing on success: signing in unmounts this screen.
    } catch (error) {
      setSubmitState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Could not sign in.",
      });
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View
        pointerEvents="none"
        style={[
          styles.heroAccentPrimary,
          { backgroundColor: theme.primary ?? theme.iconColor },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.heroAccentSecondary,
          { backgroundColor: theme.secondary ?? theme.primary },
        ]}
      />

      <View style={styles.content}>
        <ThemedKeyboardProtection scroll contentContainerStyle={styles.scrollContent}>
          {/* One heading. This screen used to carry three - a 42 px "Login", an
              "Account" label and a 24 px "Sign in" inside the card - for two
              fields. */}
          <View style={styles.heroBlock}>
            <ThemedText style={styles.eyebrow} setColor={quietText}>
              FitVen
            </ThemedText>
            <ThemedText style={styles.title} setColor={titleColor}>
              Login
            </ThemedText>
            <ThemedText style={styles.subtitle} setColor={quietText}>
              Sign in to load your programs and workouts.
            </ThemedText>
          </View>

          <ThemedCard
            style={[
              styles.loginCard,
              {
                backgroundColor: cardSurface,
                borderColor: cardBorder,
              },
            ]}
          >
            <View style={styles.formSection}>
              <ThemedText style={styles.inputLabel} setColor={quietText}>
                Email
              </ThemedText>
              <ThemedTextInput
                value={email}
                onChangeText={(nextEmail) => {
                  setEmail(nextEmail);
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
              <ThemedText style={styles.inputLabel} setColor={quietText}>
                Password
              </ThemedText>
              <ThemedTextInput
                value={password}
                onChangeText={(nextPassword) => {
                  setPassword(nextPassword);
                  clearErrors();
                }}
                placeholder="Enter password"
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                error={fieldErrors.password}
                style={styles.inputWrapper}
                action={{
                  label: isPasswordVisible ? "Hide password" : "Show password",
                  onPress: () => setIsPasswordVisible((shown) => !shown),
                  icon: (
                    <Eye
                      width={20}
                      height={20}
                      color={isPasswordVisible ? theme.primary : theme.iconColor}
                    />
                  ),
                }}
              />
            </View>
          </ThemedCard>

          <View style={styles.actions}>
            <ThemedButton
              title={isSigningIn ? "Signing in..." : "Login"}
              onPress={handleLogin}
              fullWidth
              style={styles.primaryButton}
              disabled={isSigningIn}
            />

            {/* Directly under the button it belongs to, with an icon, so it is
                not mistaken for a caption on whatever sits below it. */}
            {submitState.status === "error" && submitState.message ? (
              <View style={styles.errorRow}>
                <Cross width={15} height={15} color={theme.danger} />
                <ThemedText style={styles.errorText} setColor={theme.danger}>
                  {submitState.message}
                </ThemedText>
              </View>
            ) : null}

            {submitState.status === "sent" && submitState.message ? (
              <View style={styles.errorRow}>
                <Checkmark width={15} height={15} color={theme.secondary} />
                <ThemedText style={styles.errorText} setColor={quietText}>
                  {submitState.message}
                </ThemedText>
              </View>
            ) : null}

            <Pressable
              onPress={handleForgotPassword}
              disabled={isSendingReset}
              accessibilityRole="button"
              style={styles.forgotLink}
            >
              {/* Quiet grey, not the accent. This is the way out for the few
                  people who need it, not something to draw the eye away from
                  the field they were about to fill in. */}
              <ThemedText style={styles.forgotLinkText} setColor={quietText}>
                {isSendingReset ? "Sending..." : "Forgot password?"}
              </ThemedText>
            </Pressable>

            <View style={styles.alternativeBlock}>
              <ThemedText style={styles.alternativeLabel} setColor={quietText}>
                New here?
              </ThemedText>
              {/* An outline, not a second orange button. Two identical fills
                  stacked on top of each other said nothing about which one was
                  the thing you came here to do. */}
              <ThemedButton
                title="Create account"
                variant="secondary"
                onPress={() => navigation.navigate("RegisterPage")}
                fullWidth
                style={styles.primaryButton}
              />
            </View>
          </View>
        </ThemedKeyboardProtection>
      </View>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
