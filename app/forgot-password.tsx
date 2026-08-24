import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, radii } from "../lib/theme";
import { supabase } from "../lib/supabase";
import { usePreferences } from "../lib/preferences-context";
import { localize } from "../lib/i18n";
export default function ForgotPassword() {
  const prefs = usePreferences();
  const L = (en: string, fr: string, es: string) =>
    localize(prefs.language, en, fr, es);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  async function send() {
    if (!supabase) return;
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      return Alert.alert(
        L("Email required", "Email requis", "Email obligatorio"),
        L(
          "Enter a valid email address.",
          "Saisissez une adresse email valide.",
          "Introduce un correo válido.",
        ),
      );
    setLoading(true);
    const redirectTo =
      typeof window === "undefined"
        ? "/reset-password"
        : new URL("/reset-password", window.location.origin).toString();
    const { error } = await supabase.auth.resetPasswordForEmail(value, {
      redirectTo,
    });
    setLoading(false);
    if (error)
      return Alert.alert(
        L(
          "Could not send reset email",
          "Impossible d’envoyer l’email",
          "No se pudo enviar el correo",
        ),
        error.message,
      );
    setSent(true);
  }
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={s.back}>‹ {prefs.tr("back")}</Text>
        </Pressable>
        <Text style={s.eyebrow}>
          {L(
            "ACCOUNT RECOVERY",
            "RÉCUPÉRATION DU COMPTE",
            "RECUPERACIÓN DE CUENTA",
          )}
        </Text>
        <Text style={s.title}>
          {L(
            "Reset your password.",
            "Réinitialisez votre mot de passe.",
            "Restablece tu contraseña.",
          )}
        </Text>
        <Text style={s.sub}>
          {sent
            ? L(
                "Check your inbox for a secure password reset link.",
                "Consultez votre boîte mail pour le lien sécurisé de réinitialisation.",
                "Revisa tu correo para encontrar el enlace seguro de restablecimiento.",
              )
            : L(
                "Enter the email attached to your MediCrew account.",
                "Saisissez l’email associé à votre compte MediCrew.",
                "Introduce el correo asociado a tu cuenta MediCrew.",
              )}
        </Text>
        {!sent && (
          <>
            <Text style={s.label}>
              {L("Email address", "Adresse email", "Correo electrónico")}
            </Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              style={s.input}
            />
            <Pressable disabled={loading} onPress={send} style={s.primary}>
              <Text style={s.primaryText}>
                {loading
                  ? L("Sending…", "Envoi…", "Enviando…")
                  : L("Send reset link", "Envoyer le lien", "Enviar enlace")}
              </Text>
            </Pressable>
          </>
        )}
        {sent && (
          <Pressable onPress={() => router.replace("/auth")} style={s.primary}>
            <Text style={s.primaryText}>
              {L(
                "Return to sign in",
                "Retour à la connexion",
                "Volver al inicio de sesión",
              )}
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { flex: 1, padding: 24, justifyContent: "center" },
  back: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 35,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.5,
    color: colors.green,
  },
  title: { fontSize: 35, fontWeight: "900", color: colors.ink, marginTop: 8 },
  sub: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
    marginTop: 9,
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 7,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
  },
  primary: {
    height: 55,
    borderRadius: radii.md,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: "900" },
});
