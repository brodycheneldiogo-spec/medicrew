import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../lib/supabase";
import { avatarUrl } from "../lib/avatar";
import { colors, radii } from "../lib/theme";
import { usePreferences } from "../lib/preferences-context";
import { localize } from "../lib/i18n";
import { UserSafetyActions } from "../lib/user-safety-actions";
export default function NetworkProfile() {
  const prefs = usePreferences();
  const L = (en: string, fr: string, es: string) =>
    localize(prefs.language, en, fr, es);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void load();
  }, [id]);
  async function load() {
    if (!supabase || !id) {
      setLoading(false);
      return;
    }
    const { data: d, error: e } = await supabase.rpc("network_profile", {
      p_profile_id: id,
    });
    if (e) setError(e.message);
    else setData(d);
    setLoading(false);
  }
  async function message() {
    if (!supabase || !id) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      if (__DEV__)
        return Alert.alert(
          "Development account",
          "Direct messaging uses real authenticated accounts.",
        );
      return router.replace("/auth");
    }
    const { data: conversation, error: e } = await supabase.rpc(
      "start_direct_conversation",
      { p_target_profile: id },
    );
    if (e)
      return Alert.alert(
        L(
          "Could not start conversation",
          "Impossible de démarrer la conversation",
          "No se pudo iniciar la conversación",
        ),
        e.message,
      );
    router.push({
      pathname: "/direct-chat",
      params: { conversationId: String(conversation), title: displayName() },
    });
  }
  function displayName() {
    return data?.role === "company"
      ? data?.company_name
      : [data?.first_name, data?.last_name].filter(Boolean).join(" ");
  }
  if (loading)
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator
          style={{ marginTop: 90 }}
          color={colors.green}
          size="large"
        />
      </SafeAreaView>
    );
  if (error || !data)
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.container}>
          <Pressable onPress={() => router.back()}>
            <Text style={s.back}>‹ {prefs.tr("back")}</Text>
          </Pressable>
          <Text style={s.title}>
            {L(
              "Profile unavailable.",
              "Profil indisponible.",
              "Perfil no disponible.",
            )}
          </Text>
          <Text style={s.sub}>
            {error ||
              L(
                "This profile is not public or verified.",
                "Ce profil n’est pas public ou vérifié.",
                "Este perfil no es público o no está verificado.",
              )}
          </Text>
        </View>
      </SafeAreaView>
    );
  const name = displayName() || "MediCrew member",
    img = avatarUrl(data.avatar_url),
    isPro = data.role === "professional";
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={s.back}>‹ {prefs.tr("network")}</Text>
        </Pressable>
        <View style={s.header}>
          {img ? (
            <Image source={{ uri: img }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.fallback]}>
              <Text style={s.initial}>{name.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.headline}>
              {data.headline ||
                (isPro
                  ? `${data.professional_type === "nurse" ? prefs.tr("nurse") : prefs.tr("doctor")}${data.specialty ? ` · ${data.specialty}` : ""}`
                  : data.company_type === "event"
                    ? L(
                        "Event medical staffing organization",
                        "Organisation médicale événementielle",
                        "Organización médica para eventos",
                      )
                    : L(
                        "Medical transport organization",
                        "Organisation de transport médical",
                        "Organización de transporte médico",
                      ))}
            </Text>
            <Text style={s.location}>
              {[data.city, data.country].filter(Boolean).join(", ")}
            </Text>
          </View>
        </View>
        <View
          style={[
            s.verified,
            { backgroundColor: isPro ? colors.proSoft : colors.companySoft },
          ]}
        >
          <Text
            style={[
              s.verifiedText,
              { color: isPro ? colors.proDark : colors.companyDark },
            ]}
          >
            ✓ {L("VERIFIED", "VÉRIFIÉ", "VERIFICADO")}{" "}
            {isPro
              ? prefs.tr("professional").toUpperCase()
              : prefs.tr("organization").toUpperCase()}
          </Text>
        </View>
        {data.bio ? <Text style={s.bio}>{data.bio}</Text> : null}
        <View style={s.card}>
          {isPro ? (
            <>
              <Row
                label={L("Profession", "Profession", "Profesión")}
                value={
                  data.professional_type === "nurse"
                    ? prefs.tr("nurse")
                    : prefs.tr("doctor")
                }
              />
              <Row
                label={L("Specialty", "Spécialité", "Especialidad")}
                value={data.specialty || "—"}
              />
              <Row
                label={L("Experience", "Expérience", "Experiencia")}
                value={`${data.years_experience || 0} ${L("years", "ans", "años")}`}
              />
              <Row
                label={L("Nationality", "Nationalité", "Nacionalidad")}
                value={data.nationality || "—"}
              />
              <Row
                label={L("Base airport", "Aéroport de base", "Aeropuerto base")}
                value={data.base_airport_code || "—"}
              />
              <Row
                label={L(
                  "Licence jurisdiction",
                  "Juridiction de licence",
                  "Jurisdicción de licencia",
                )}
                value={data.license_country || "—"}
              />
              <Row
                label={L(
                  "Issuing authority",
                  "Autorité émettrice",
                  "Autoridad emisora",
                )}
                value={data.license_authority || "—"}
              />
            </>
          ) : (
            <>
              <Row
                label={L(
                  "Organization type",
                  "Type d’organisation",
                  "Tipo de organización",
                )}
                value={
                  data.company_type === "event"
                    ? L(
                        "Event medical staffing",
                        "Médical événementiel",
                        "Personal médico para eventos",
                      )
                    : L(
                        "Medical transport",
                        "Transport médical",
                        "Transporte médico",
                      )
                }
              />
              <Row label="Website" value={data.website || "—"} />
              <Row
                label={L("Public email", "Email public", "Correo público")}
                value={data.email || "—"}
              />
            </>
          )}
        </View>
        <Pressable
          onPress={message}
          style={[
            s.message,
            { backgroundColor: isPro ? colors.proDark : colors.companyDark },
          ]}
        >
          <Text style={s.messageText}>
            {L("Message", "Message", "Mensaje")}
          </Text>
        </Pressable>
        <UserSafetyActions
          targetId={String(id)}
          onBlocked={() => router.replace("/network")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: 22, paddingBottom: 45 },
  back: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 24,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 82, height: 82, borderRadius: 26 },
  fallback: {
    backgroundColor: colors.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontSize: 20, fontWeight: "900", color: colors.greenDark },
  name: { fontSize: 25, fontWeight: "900", color: colors.ink },
  headline: { fontSize: 12.5, color: colors.ink, marginTop: 4 },
  location: { fontSize: 11, color: colors.muted, marginTop: 4 },
  verified: {
    alignSelf: "flex-start",
    marginTop: 16,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 99,
  },
  verifiedText: { fontSize: 8, fontWeight: "900", letterSpacing: 0.7 },
  bio: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 17 },
  card: {
    marginTop: 18,
    padding: 17,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  label: { fontSize: 11.5, color: colors.muted },
  value: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "right",
  },
  message: {
    height: 54,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  messageText: { fontSize: 14, fontWeight: "900", color: colors.white },
  title: { fontSize: 30, fontWeight: "900", color: colors.ink },
  sub: { fontSize: 13, color: colors.muted, marginTop: 7 },
});
