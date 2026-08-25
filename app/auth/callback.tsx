import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";
import { usePreferences } from "../../lib/preferences-context";
import { localize } from "../../lib/i18n";

const ADMIN_EMAIL = "work.medicrew.app@gmail.com";

export default function AuthCallback() {
  const prefs = usePreferences();
  const {
    code,
    error,
    error_description: errorDescription,
  } = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_description?: string;
  }>();
  const [message, setMessage] = useState(
    localize(
      prefs.language,
      "Confirming your account…",
      "Confirmation de votre compte…",
      "Confirmando tu cuenta…",
    ),
  );

  useEffect(() => {
    let active = true;
    const L = (en: string, fr: string, es: string) =>
      localize(prefs.language, en, fr, es);
    const finish = async () => {
      const client = supabase;
      if (!client) return setMessage("Supabase not configured");
      if (error) return setMessage(errorDescription || error);
      if (code) {
        const exchange = await client.auth.exchangeCodeForSession(code);
        if (exchange.error) return setMessage(exchange.error.message);
      }
      const {
        data: { user },
      } = await client.auth.getUser();
      if (!active) return;
      if (!user)
        return setMessage(
          L(
            "The confirmation link is invalid or expired.",
            "Le lien de confirmation est invalide ou expiré.",
            "El enlace de confirmación no es válido o ha caducado.",
          ),
        );

      const email = user.email?.trim().toLowerCase() || null;
      const storedRole =
        typeof window === "undefined"
          ? null
          : window.localStorage.getItem("medicrew.oauth.role");
      const storedMode =
        typeof window === "undefined"
          ? null
          : window.localStorage.getItem("medicrew.oauth.mode");
      const requestedRole =
        storedRole === "company" || user.user_metadata?.role === "company"
          ? "company"
          : "professional";
      if (storedMode === "signup") {
        const metadata = await client.auth.updateUser({
          data: {
            role: requestedRole,
            signup_complete: true,
            legal_accepted: true,
            terms_version: "2.1",
            privacy_version: "1.2",
            data_policy_version: "1.1",
            preferred_language: prefs.language,
            preferred_currency: prefs.currency,
          },
        });
        if (metadata.error) return setMessage(metadata.error.message);
      }
      if (typeof window !== "undefined") {
        window.localStorage.removeItem("medicrew.oauth.role");
        window.localStorage.removeItem("medicrew.oauth.mode");
      }
      const update = await client
        .from("profiles")
        .update(
          email === ADMIN_EMAIL ? { email } : { email, role: requestedRole },
        )
        .eq("id", user.id)
        .select("role")
        .maybeSingle();
      if (update.error) return setMessage(update.error.message);
      if (storedMode === "signup") {
        const legal = await client.rpc("accept_current_legal_terms");
        if (legal.error) return setMessage(legal.error.message);
      }
      if (!active) return;
      const { data: access } = await client.rpc("my_account_access_state");
      const state = access as { role?: string; status?: string } | null;
      if (state?.status === "banned") return router.replace("/banned");
      if (
        email === ADMIN_EMAIL ||
        update.data?.role === "admin" ||
        state?.role === "admin"
      )
        return router.replace("/admin");
      router.replace(
        requestedRole === "company"
          ? "/onboarding?role=company"
          : "/onboarding?role=professional",
      );
    };
    void finish();
    return () => {
      active = false;
    };
  }, [code, error, errorDescription, prefs.currency, prefs.language]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.green} />
        <Text style={s.text}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  text: {
    marginTop: 18,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    color: colors.muted,
  },
});
