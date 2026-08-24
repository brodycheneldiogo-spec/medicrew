import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, radii } from "./theme";
import { supabase } from "./supabase";
import { usePreferences } from "./preferences-context";
import { localize } from "./i18n";

const reasons = [
  [
    "harassment",
    "Harassment or threats",
    "Harcèlement ou menaces",
    "Acoso o amenazas",
  ],
  ["spam", "Spam", "Spam", "Spam"],
  ["fraud", "Fraud or scam", "Fraude ou arnaque", "Fraude o estafa"],
  [
    "impersonation",
    "Impersonation",
    "Usurpation d’identité",
    "Suplantación de identidad",
  ],
  [
    "unsafe_behavior",
    "Unsafe behavior",
    "Comportement dangereux",
    "Comportamiento peligroso",
  ],
  [
    "inappropriate_content",
    "Inappropriate content",
    "Contenu inapproprié",
    "Contenido inapropiado",
  ],
  ["other", "Other", "Autre", "Otro"],
] as const;

export function UserSafetyActions({
  targetId,
  conversationId,
  onBlocked,
}: {
  targetId: string;
  conversationId?: string;
  onBlocked?: () => void;
}) {
  const prefs = usePreferences();
  const L = (en: string, fr: string, es: string) =>
    localize(prefs.language, en, fr, es);
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [explanation, setExplanation] = useState("");
  const [blocked, setBlocked] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      if (!supabase || !targetId) return;
      const { data } = await supabase.rpc("user_relationship_state", {
        p_target_profile: targetId,
      });
      setBlocked(Boolean(data?.blocked_by_me));
    })();
  }, [targetId]);

  async function toggleBlock() {
    if (!supabase || busy) return;
    const next = !blocked;
    const title = next
      ? L(
          "Block this user?",
          "Bloquer cet utilisateur ?",
          "¿Bloquear a este usuario?",
        )
      : L(
          "Unblock this user?",
          "Débloquer cet utilisateur ?",
          "¿Desbloquear a este usuario?",
        );
    const detail = next
      ? L(
          "You will no longer see each other in the network or be able to exchange messages.",
          "Vous ne vous verrez plus dans le réseau et ne pourrez plus échanger de messages.",
          "Ya no os veréis en la red ni podréis intercambiar mensajes.",
        )
      : L(
          "Messaging and network visibility may become available again.",
          "La messagerie et la visibilité dans le réseau pourront redevenir disponibles.",
          "La mensajería y la visibilidad podrán volver a estar disponibles.",
        );
    const run = async () => {
      setBusy(true);
      setError("");
      const { error: e } = await supabase!.rpc("set_user_block", {
        p_target_profile: targetId,
        p_blocked: next,
      });
      setBusy(false);
      if (e) return setError(e.message);
      setBlocked(next);
      if (next) onBlocked?.();
    };
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(`${title}\n\n${detail}`)
      )
        await run();
      return;
    }
    Alert.alert(title, detail, [
      { text: L("Cancel", "Annuler", "Cancelar"), style: "cancel" },
      {
        text: next
          ? L("Block", "Bloquer", "Bloquear")
          : L("Unblock", "Débloquer", "Desbloquear"),
        style: next ? "destructive" : "default",
        onPress: run,
      },
    ]);
  }

  async function submit() {
    if (!supabase || busy) return;
    if (!reason)
      return setError(
        L("Choose a reason.", "Choisissez une raison.", "Elige un motivo."),
      );
    if (explanation.trim().length < 10)
      return setError(
        L(
          "Add an explanation of at least 10 characters.",
          "Ajoutez une explication d’au moins 10 caractères.",
          "Añade una explicación de al menos 10 caracteres.",
        ),
      );
    setBusy(true);
    setError("");
    const { error: e } = await supabase.rpc("submit_user_report", {
      p_target_profile: targetId,
      p_reason: reason,
      p_explanation: explanation.trim(),
      p_conversation_id: conversationId || null,
    });
    setBusy(false);
    if (e) return setError(e.message);
    setOpen(false);
    setReason("");
    setExplanation("");
    Alert.alert(
      L("Report sent", "Signalement envoyé", "Denuncia enviada"),
      L(
        "The MediCrew moderation team will review it.",
        "L’équipe de modération MediCrew va l’examiner.",
        "El equipo de moderación de MediCrew la revisará.",
      ),
    );
  }

  return (
    <View style={s.wrap}>
      <View style={s.actions}>
        <Pressable
          disabled={busy}
          onPress={() => setOpen((v) => !v)}
          style={s.report}
        >
          <Text style={s.reportText}>
            {L("Report", "Signaler", "Denunciar")}
          </Text>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={toggleBlock}
          style={[s.block, blocked && s.unblock]}
        >
          <Text style={s.blockText}>
            {blocked
              ? L("Unblock", "Débloquer", "Desbloquear")
              : L("Block", "Bloquer", "Bloquear")}
          </Text>
        </Pressable>
      </View>
      {open ? (
        <View style={s.panel}>
          <Text style={s.title}>
            {L(
              "Why are you reporting this profile?",
              "Pourquoi signalez-vous ce profil ?",
              "¿Por qué denuncias este perfil?",
            )}
          </Text>
          <View style={s.reasons}>
            {reasons.map(([value, en, fr, es]) => (
              <Pressable
                key={value}
                onPress={() => setReason(value)}
                style={[s.chip, reason === value && s.chipOn]}
              >
                <Text style={[s.chipText, reason === value && s.chipTextOn]}>
                  {L(en, fr, es)}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={explanation}
            onChangeText={setExplanation}
            multiline
            maxLength={2000}
            placeholder={L(
              "Explain what happened (required)…",
              "Expliquez ce qui s’est passé (obligatoire)…",
              "Explica lo ocurrido (obligatorio)…",
            )}
            style={s.input}
          />
          {error ? <Text style={s.error}>{error}</Text> : null}
          <Pressable disabled={busy} onPress={submit} style={s.submit}>
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={s.submitText}>
                {L("Send report", "Envoyer le signalement", "Enviar denuncia")}
              </Text>
            )}
          </Pressable>
        </View>
      ) : error ? (
        <Text style={s.error}>{error}</Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: 12 },
  actions: { flexDirection: "row", gap: 9 },
  report: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#E0B566",
    backgroundColor: "#FFF9EC",
    alignItems: "center",
    justifyContent: "center",
  },
  reportText: { fontSize: 12, fontWeight: "900", color: "#835A12" },
  block: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: "#A33A3A",
    alignItems: "center",
    justifyContent: "center",
  },
  unblock: { backgroundColor: colors.muted },
  blockText: { fontSize: 12, fontWeight: "900", color: colors.white },
  panel: {
    marginTop: 10,
    padding: 15,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  title: { fontSize: 14, fontWeight: "900", color: colors.ink },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 10, fontWeight: "800", color: colors.ink },
  chipTextOn: { color: colors.white },
  input: {
    minHeight: 105,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    color: colors.ink,
    textAlignVertical: "top",
  },
  submit: {
    height: 48,
    marginTop: 10,
    borderRadius: radii.md,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { fontSize: 12, fontWeight: "900", color: colors.white },
  error: { marginTop: 8, fontSize: 11, color: colors.danger },
});
