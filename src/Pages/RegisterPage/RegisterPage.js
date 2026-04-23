import { StatusBar } from "expo-status-bar";
import { View, useColorScheme } from "react-native";
import { useState } from "react";

import styles from "./RegisterPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { registerWithEmail } from "../../Database/supaBaseClient";
import {
  ThemedButton,
  ThemedCard,
  ThemedHeader,
  ThemedKeyboardProtection,
  ThemedText,
  ThemedTextInput,
  ThemedView,
} from "../../Resources/ThemedComponents";

export default function RegisterPage() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme] ?? Colors.light;
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");
  const [submitState, setSubmitState] = useState({
    status: "idle",
    message: "",
  });
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const normalizedUsername = username.trim().toLowerCase();
  const usernameInvalid =
    normalizedUsername.length > 0 &&
    !/^[a-z0-9_]{3,20}$/.test(normalizedUsername);
  const passwordsMismatch =
    retypePassword.length > 0 && password !== retypePassword;
  const isFormIncomplete =
    username.trim().length === 0 ||
    email.trim().length === 0 ||
    password.length === 0 ||
    retypePassword.length === 0;
  const passwordTooShort = password.length > 0 && password.length < 6;
  const statusColor =
    submitState.status === "success"
      ? theme.secondary ?? titleColor
      : submitState.status === "error"
        ? theme.danger ?? titleColor
        : quietText;

  const handleRegister = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedUsername || !normalizedEmail || !password || !retypePassword) {
      setSubmitState({
        status: "error",
        message: "Fill out username, email and both password fields first.",
      });
      return;
    }

    if (!/^[a-z0-9_]{3,20}$/.test(normalizedUsername)) {
      setSubmitState({
        status: "error",
        message:
          "Username must be 3-20 characters and use only lowercase letters, numbers or underscores.",
      });
      return;
    }

    if (passwordsMismatch) {
      setSubmitState({
        status: "error",
        message: "Passwords do not match.",
      });
      return;
    }

    if (password.length < 6) {
      setSubmitState({
        status: "error",
        message: "Password must be at least 6 characters.",
      });
      return;
    }

    setSubmitState({
      status: "loading",
      message: "Creating account...",
    });

    try {
      const result = await registerWithEmail({
        email: normalizedEmail,
        password,
        username: normalizedUsername,
      });

      const needsEmailConfirmation = !result.session;

      setSubmitState({
        status: "success",
        message: needsEmailConfirmation
          ? "Account created. Check your email to confirm the account."
          : "Account created. You can now sign in.",
      });

      setUsername("");
      setEmail(normalizedEmail);
      setPassword("");
      setRetypePassword("");
    } catch (error) {
      setSubmitState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not create account.",
      });
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedHeader />

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
          <View style={styles.heroBlock}>
            <ThemedText style={styles.eyebrow} setColor={quietText}>
              FitVen Cloud
            </ThemedText>
            <ThemedText style={styles.title} setColor={titleColor}>
              Register
            </ThemedText>
            <ThemedText style={styles.subtitle} setColor={quietText}>
              Create a new cloud account for syncing programs and workouts.
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
            <ThemedText style={styles.cardLabel} setColor={quietText}>
              New account
            </ThemedText>
            <ThemedText style={styles.cardTitle} setColor={titleColor}>
              Account details
            </ThemedText>

            <View style={styles.formSection}>
              <ThemedText style={styles.inputLabel} setColor={quietText}>
                Username
              </ThemedText>
              <ThemedTextInput
                value={username}
                onChangeText={setUsername}
                placeholder="your_name"
                autoCapitalize="none"
                autoCorrect={false}
                error={
                  usernameInvalid
                    ? "Use 3-20 lowercase letters, numbers or underscores."
                    : undefined
                }
                style={styles.inputWrapper}
              />
            </View>

            <View style={styles.formSection}>
              <ThemedText style={styles.inputLabel} setColor={quietText}>
                Email
              </ThemedText>
              <ThemedTextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.inputWrapper}
              />
            </View>

            <View style={styles.formSection}>
              <ThemedText style={styles.inputLabel} setColor={quietText}>
                Password
              </ThemedText>
              <ThemedTextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                error={passwordTooShort ? "Password must be at least 6 characters." : undefined}
                style={styles.inputWrapper}
              />
            </View>

            <View style={styles.formSection}>
              <ThemedText style={styles.inputLabel} setColor={quietText}>
                Retype password
              </ThemedText>
              <ThemedTextInput
                value={retypePassword}
                onChangeText={setRetypePassword}
                placeholder="Retype password"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                error={passwordsMismatch ? "Passwords do not match." : undefined}
                style={styles.inputWrapper}
              />
            </View>
          </ThemedCard>

          <View style={styles.actions}>
            <ThemedButton
              title={
                submitState.status === "loading"
                  ? "Registering..."
                  : "Register"
              }
              onPress={handleRegister}
              fullWidth
              style={styles.primaryButton}
              disabled={
                submitState.status === "loading" ||
                isFormIncomplete ||
                usernameInvalid ||
                passwordsMismatch ||
                passwordTooShort
              }
            />

            {submitState.message ? (
              <ThemedText
                style={styles.connectionStatus}
                setColor={statusColor}
              >
                {submitState.message}
              </ThemedText>
            ) : null}
          </View>
        </ThemedKeyboardProtection>
      </View>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
