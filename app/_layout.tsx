import { useEffect } from "react";
import { Stack, router, useSegments } from "expo-router";
import { StatusBar, StyleSheet, View } from "react-native";
import { colors } from "../lib/theme";
import { supabase } from "../lib/supabase";
import { PreferencesProvider } from "../lib/preferences-context";
import "./global.css";

const EXEMPT = new Set([
  "",
  "auth",
  "auth/callback",
  "forgot-password",
  "reset-password",
  "verify-email",
  "legal-consent",
  "onboarding",
  "professional/passport",
  "professional/verification",
  "company-verification",
  "pending-review",
  "banned",
  "terms",
  "privacy",
  "data-policy",
  "admin",
  "admin-preview",
]);
function VerificationAccessGuard() {
  const segments = useSegments();
  useEffect(() => {
    let alive = true;
    const check = async () => {
      const c = supabase;
      if (!c) return;
      const {
        data: { user },
      } = await c.auth.getUser();
      if (!user || !alive) return;
      const path = segments.join("/");
      if (EXEMPT.has(path)) return;
      const { data, error } = await c.rpc("my_account_access_state");
      if (error || !alive) return;
      const state = (data || {}) as {
        role?: string;
        status?: string;
        allowed?: boolean;
      };
      if (state.status === "banned") return router.replace("/banned" as never);
      if (state.role === "admin") return;
      if (state.allowed === false) router.replace("/pending-review" as never);
    };
    void check();
    return () => {
      alive = false;
    };
  }, [segments]);
  return null;
}

export default function RootLayout() {
  return (
    <PreferencesProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <VerificationAccessGuard />
      <View style={styles.page}>
        <View style={styles.app}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.paper },
              animation: "fade",
            }}
          />
        </View>
      </View>
    </PreferencesProvider>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    backgroundColor: "#EAF3EF",
  },
  app: {
    flex: 1,
    width: "100%",
    maxWidth: 1440,
    backgroundColor: colors.paper,
  },
});
