import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { colors, radii } from "../lib/theme";
import { usePreferences } from "../lib/preferences-context";
import { localize } from "../lib/i18n";

export default function Banned() {
  const prefs = usePreferences(),
    L = (en: string, fr: string, es: string) =>
      localize(prefs.language, en, fr, es);
  const [loading, setLoading] = useState(true),
    [reason, setReason] = useState("");
  useEffect(() => {
    void (async () => {
      if (!supabase) return setLoading(false);
      const { data } = await supabase.rpc("my_account_access_state");
      if (data?.status !== "banned") return router.replace("/");
      setReason(
        data?.reason ||
          localize(
            prefs.language,
            "Violation of the MediCrew rules.",
            "Violation des règles MediCrew.",
            "Incumplimiento de las normas de MediCrew.",
          ),
      );
      setLoading(false);
    })();
  }, [prefs.language]);
  async function logout() {
    await supabase?.auth.signOut();
    router.replace("/auth");
  }
  if (loading)
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={colors.danger} />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.card}>
        <View style={s.icon}>
          <Text style={s.iconText}>!</Text>
        </View>
        <Text style={s.eyebrow}>MEDICREW · ACCOUNT ACCESS</Text>
        <Text style={s.title}>
          {L(
            "Your account has been permanently banned.",
            "Votre compte a été banni définitivement.",
            "Tu cuenta ha sido bloqueada permanentemente.",
          )}
        </Text>
        <Text style={s.label}>{L("Reason", "Raison", "Motivo")}</Text>
        <Text style={s.reason}>{reason}</Text>
        <Text style={s.help}>
          {L(
            "If you believe this decision is an error, contact MediCrew support from the public website. Creating another account to bypass this decision is prohibited.",
            "Si vous pensez que cette décision est une erreur, contactez le support MediCrew depuis le site public. Créer un autre compte pour contourner cette décision est interdit.",
            "Si crees que esta decisión es un error, contacta con el soporte de MediCrew desde el sitio público. Está prohibido crear otra cuenta para eludirla.",
          )}
        </Text>
        <Pressable onPress={logout} style={s.button}>
          <Text style={s.buttonText}>
            {L("Log out", "Se déconnecter", "Cerrar sesión")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F9F3F3",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  card: {
    width: "100%",
    maxWidth: 620,
    padding: 28,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: "#E7C7C7",
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FDECEC",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 30, fontWeight: "900", color: colors.danger },
  eyebrow: {
    marginTop: 20,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: colors.danger,
  },
  title: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    color: colors.ink,
  },
  label: {
    marginTop: 24,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.muted,
  },
  reason: {
    marginTop: 7,
    padding: 15,
    borderRadius: 14,
    backgroundColor: "#FFF5F5",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: "#8E3030",
  },
  help: { marginTop: 17, fontSize: 12, lineHeight: 19, color: colors.muted },
  button: {
    height: 52,
    marginTop: 22,
    borderRadius: radii.md,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 13, fontWeight: "900", color: colors.white },
});
