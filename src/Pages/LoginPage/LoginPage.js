import { StatusBar } from "expo-status-bar";
import { View, useColorScheme } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useState } from "react";

import styles from "./LoginPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { authService } from "../../Services";
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
  const [submitState, setSubmitState] = useState({
    status: "idle",
    message: "",
  });
  const titleColor = theme.title ?? theme.text;
  const quietText = theme.quietText ?? theme.iconColor ?? theme.text;
  const cardSurface = theme.cardBackground ?? theme.background;
  const cardBorder = theme.cardBorder ?? theme.iconColor ?? theme.text;
  const isFormIncomplete = email.trim().length === 0 || password.length === 0;
  const statusColor =
    submitState.status === "success"
      ? theme.secondary ?? titleColor
      : submitState.status === "error"
        ? theme.danger ?? titleColor
        : quietText;

  const handleLogin = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setSubmitState({
        status: "error",
        message: "Enter both email and password first.",
      });
      return;
    }

    setSubmitState({
      status: "loading",
      message: "Signing in...",
    });

    try {
      await authService.login({
        email: normalizedEmail,
        password,
      });

      setSubmitState({
        status: "success",
        message: "Login successful.",
      });
    } catch (error) {
      setSubmitState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not sign in.",
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
          <View style={styles.heroBlock}>
            <ThemedText style={styles.eyebrow} setColor={quietText}>
              FitVen Cloud
            </ThemedText>
            <ThemedText style={styles.title} setColor={titleColor}>
              Login
            </ThemedText>
            <ThemedText style={styles.subtitle} setColor={quietText}>
              Sign in to your cloud account to load programs and workouts.
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
            <ThemedText style={styles.cardLabel} setColor={quietText}>
              Account
            </ThemedText>
            <ThemedText style={styles.cardTitle} setColor={titleColor}>
              Sign in
            </ThemedText>

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
                style={styles.inputWrapper}
              />
            </View>
          </ThemedCard>

          <View style={styles.actions}>
            <ThemedButton
              title={
                submitState.status === "loading"
                  ? "Signing in..."
                  : "Login"
              }
              onPress={handleLogin}
              fullWidth
              style={styles.primaryButton}
              disabled={submitState.status === "loading" || isFormIncomplete}
            />

            {submitState.message ? (
              <ThemedText
                style={styles.connectionStatus}
                setColor={statusColor}
              >
                {submitState.message}
              </ThemedText>
            ) : null}

            <ThemedButton
              title="Create account"
              onPress={() => navigation.navigate("RegisterPage")}
              fullWidth
              style={[styles.primaryButton, styles.secondaryActionButton]}
            />
          </View>
        </ThemedKeyboardProtection>
      </View>

      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemedView>
  );
}
