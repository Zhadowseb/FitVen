import { AppState } from "react-native";
import { useEffect, useRef } from "react";

import { useAuth } from "../Contexts/AuthContext";
import { notificationService } from "../Services";

export default function PushNotificationRegistrationSync() {
  const { user, isAuthenticated, isAuthLoading } = useAuth();
  const isRegisteringRef = useRef(false);
  const registrationRequestedRef = useRef(false);
  const pendingDevicePushTokenRef = useRef(null);

  const runRegistration = async ({ devicePushToken = null } = {}) => {
    if (isAuthLoading || !isAuthenticated || !user?.id) {
      registrationRequestedRef.current = false;
      pendingDevicePushTokenRef.current = null;
      return;
    }

    registrationRequestedRef.current = true;

    if (devicePushToken) {
      pendingDevicePushTokenRef.current = devicePushToken;
    }

    if (isRegisteringRef.current) {
      return;
    }

    isRegisteringRef.current = true;

    try {
      while (registrationRequestedRef.current) {
        registrationRequestedRef.current = false;
        const nextDevicePushToken = pendingDevicePushTokenRef.current;
        pendingDevicePushTokenRef.current = null;

        try {
          const result = await notificationService.registerPushTokenForUser({
            user,
            devicePushToken: nextDevicePushToken,
          });

          if (result?.skipped) {
            console.info(
              "Push token registration skipped:",
              result.reason ?? "unknown"
            );
          }
        } catch (error) {
          console.warn("Push token registration failed:", error);
        }
      }
    } finally {
      isRegisteringRef.current = false;
    }
  };

  useEffect(() => {
    runRegistration();
  }, [isAuthenticated, isAuthLoading, user?.id]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        runRegistration();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, isAuthLoading, user?.id]);

  useEffect(() => {
    const subscription = notificationService.addPushTokenListener(
      (devicePushToken) => {
        runRegistration({ devicePushToken });
      }
    );

    return () => {
      subscription?.remove();
    };
  }, [isAuthenticated, isAuthLoading, user?.id]);

  return null;
}
