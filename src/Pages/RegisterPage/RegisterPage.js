import { StatusBar } from "expo-status-bar";
import { TouchableOpacity, View, useColorScheme } from "react-native";
import { useState } from "react";
import { useNavigation } from "@react-navigation/native";

import styles from "./RegisterPageStyle";
import { Colors } from "../../Resources/GlobalStyling/colors";
import { authService } from "../../Services";
import { useTranslation } from "@localization";
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
  const { t } = useTranslation();
  const [usernameBase, setUsernameBase] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
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
      : t("auth.register.usernamePreviewExample");
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
      errors.username = t("auth.register.errors.pickUsername");
    } else if (!isValidUsernameBase(normalizedUsername)) {
      errors.username = t("auth.register.errors.usernameRules");
    }

    if (!normalizedEmail) {
      errors.email = t("auth.errors.enterEmail");
    }

    if (!password) {
      errors.password = t("auth.register.errors.choosePassword");
    } else if (password.length < MINIMUM_PASSWORD_LENGTH) {
      errors.password = t("auth.register.passwordMinLength", {
        count: MINIMUM_PASSWORD_LENGTH,
      });
    }

    if (!retypePassword) {
      errors.retypePassword = t("auth.register.errors.repeatPassword");
    } else if (password !== retypePassword) {
      errors.retypePassword = t("auth.register.errors.passwordsDiffer");
    }

    // Required, and deliberately not pre-ticked. App Review asks for the terms
    // to be agreed to before registering, and an agreement nobody had to make
    // is not one.
    if (!hasAcceptedTerms) {
      errors.terms = t("auth.register.errors.acceptTerms");
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
          error instanceof Error
            ? error.message
            : t("auth.register.errors.couldNotCreate"),
      });
    }
  };

  const goToLogin = () => navigation.navigate("LoginPage");

  return (
    <ThemedView style={styles.container}>
      {/* The bar used to be a back arrow alone in an empty band. */}
      <ThemedHeader>
        <ThemedTitle type="h3" numberOfLines={1}>
          {t("auth.createAccount")}
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
                  ? t("auth.register.done.confirmEmailTitle")
                  : t("auth.register.done.accountCreatedTitle")}
              </ThemedText>

              <ThemedText style={styles.doneBody} setColor={quietText}>
                {createdAccount.needsEmailConfirmation
                  ? t("auth.register.done.confirmEmailBody", {
                      email: createdAccount.email,
                    })
                  : t("auth.register.done.accountCreatedBody")}
              </ThemedText>

              <ThemedButton
                title={t("auth.register.done.goToLogin")}
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
                  {t("auth.register.subtitle")}
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
                    {t("auth.register.username")}
                  </ThemedText>
                  <ThemedTextInput
                    value={usernameBase}
                    onChangeText={(next) => {
                      setUsernameBase(next);
                      clearErrors();
                    }}
                    placeholder={t("auth.register.usernamePlaceholder")}
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={fieldErrors.username}
                    style={styles.inputWrapper}
                  />
                  {fieldErrors.username ? null : (
                    <ThemedText style={styles.fieldHint} setColor={quietText}>
                      {t("auth.register.usernameHint", {
                        preview: usernamePreview,
                      })}
                    </ThemedText>
                  )}
                </View>

                <View style={styles.formSection}>
                  <ThemedText style={styles.inputLabel} setColor={titleColor}>
                    {t("auth.fields.email")}
                  </ThemedText>
                  <ThemedTextInput
                    value={email}
                    onChangeText={(next) => {
                      setEmail(next);
                      clearErrors();
                    }}
                    placeholder={t("auth.fields.emailPlaceholder")}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    error={fieldErrors.email}
                    style={styles.inputWrapper}
                  />
                </View>

                <View style={styles.formSection}>
                  <ThemedText style={styles.inputLabel} setColor={titleColor}>
                    {t("auth.fields.password")}
                  </ThemedText>
                  <ThemedTextInput
                    value={password}
                    onChangeText={(next) => {
                      setPassword(next);
                      clearErrors();
                    }}
                    placeholder={t("auth.fields.passwordPlaceholder")}
                    secureTextEntry={!isPasswordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={fieldErrors.password}
                    style={styles.inputWrapper}
                    action={{
                      label: isPasswordVisible
                        ? t("auth.fields.hidePassword")
                        : t("auth.fields.showPassword"),
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
                      {t("auth.register.passwordMinLength", {
                        count: MINIMUM_PASSWORD_LENGTH,
                      })}
                    </ThemedText>
                  )}
                </View>

                <View style={styles.formSection}>
                  <ThemedText style={styles.inputLabel} setColor={titleColor}>
                    {t("auth.register.repeatPassword")}
                  </ThemedText>
                  <ThemedTextInput
                    value={retypePassword}
                    onChangeText={(next) => {
                      setRetypePassword(next);
                      clearErrors();
                    }}
                    placeholder={t("auth.register.repeatPassword")}
                    secureTextEntry={!isPasswordVisible}
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={fieldErrors.retypePassword}
                    style={styles.inputWrapper}
                  />
                </View>
              </ThemedCard>

              <View style={styles.actions}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: hasAcceptedTerms }}
                  accessibilityLabel={t("auth.register.termsCheckboxAccessibility")}
                  onPress={() => setHasAcceptedTerms((accepted) => !accepted)}
                  style={styles.termsRow}
                >
                  <View
                    style={[
                      styles.termsBox,
                      {
                        borderColor: fieldErrors.terms
                          ? theme.danger
                          : hasAcceptedTerms
                            ? theme.primary
                            : cardBorder,
                        backgroundColor: hasAcceptedTerms
                          ? theme.primary
                          : "transparent",
                      },
                    ]}
                  >
                    {hasAcceptedTerms ? (
                      <Checkmark width={13} height={13} color={theme.background} />
                    ) : null}
                  </View>

                  {/* The second sentence is the no-tolerance line App Review
                      asked for, in the user's language. scripts/test-terms-of-use.js
                      keeps it in step with TERMS_SUMMARY in Legal/termsOfUse.js. */}
                  <ThemedText style={styles.termsText} setColor={quietText}>
                    {t("auth.register.termsCheckbox")}{" "}
                    {t("auth.register.termsSummary")}
                  </ThemedText>
                </TouchableOpacity>

                {fieldErrors.terms ? (
                  <View style={styles.errorRow}>
                    <Cross width={15} height={15} color={theme.danger} />
                    <ThemedText style={styles.errorText} setColor={theme.danger}>
                      {fieldErrors.terms}
                    </ThemedText>
                  </View>
                ) : null}

                <TouchableOpacity
                  activeOpacity={0.7}
                  accessibilityRole="link"
                  onPress={() => navigation.navigate("TermsOfUsePage")}
                  style={styles.privacyLink}
                >
                  <ThemedText
                    style={styles.privacyLinkText}
                    setColor={quietText}
                  >
                    {t("auth.register.readFullTerms")}
                  </ThemedText>
                </TouchableOpacity>

                <ThemedButton
                  title={
                    isRegistering
                      ? t("auth.register.creating")
                      : t("auth.createAccount")
                  }
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
                    {t("auth.register.howDataIsHandled")}
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
