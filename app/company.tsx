import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { avatarUrl } from "../lib/avatar";
import { colors, gradients, radii } from "../lib/theme";
import { usePreferences } from "../lib/preferences-context";
import { OptionIllustration } from "../lib/option-illustration";
import { AnimatedPressable as Pressable } from "../lib/animated-pressable";
import { MissionIllustration } from "../lib/mission-illustration";
type Mission = {
  id: string;
  title: string;
  departure_location: string;
  destination_location: string;
  departure_airport_code?: string;
  arrival_airport_code?: string;
  departure_at: string;
  professional_type: "doctor" | "nurse";
  compensation_cents: number;
  compensation_currency?: string;
  status: string;
  mission_kind: "transport" | "event";
  event_city?: string;
  event_country?: string;
  event_name?: string;
};
export default function CompanyHome() {
  const prefs = usePreferences();
  const [missions, setMissions] = useState<Mission[]>([]),
    [loading, setLoading] = useState(true),
    [preview, setPreview] = useState(false),
    [error, setError] = useState(""),
    [company, setCompany] = useState<any>(null);
  useEffect(() => {
    void load();
  }, []);
  async function load() {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      if (__DEV__) {
        setPreview(true);
        setLoading(false);
        return;
      }
      setError("Sign in required");
      setLoading(false);
      return;
    }
    const [
      { data: m, error: me },
      { data: c, error: ce },
      { data: p, error: pe },
    ] = await Promise.all([
      supabase
        .from("missions")
        .select(
          "id,title,departure_location,destination_location,departure_airport_code,arrival_airport_code,departure_at,professional_type,compensation_cents,compensation_currency,status,mission_kind,event_city,event_country,event_name",
        )
        .eq("company_id", user.id)
        .order("departure_at", { ascending: true })
        .limit(50),
      supabase
        .from("companies")
        .select("company_name,verification_status,company_type")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
    if (me || ce || pe)
      setError((me || ce || pe)?.message || "Unable to load organization");
    else {
      setMissions((m || []) as Mission[]);
      setCompany({ ...c, avatar_url: p?.avatar_url || null });
    }
    setLoading(false);
  }
  const photo = avatarUrl(company?.avatar_url),
    kind = company?.company_type === "event" ? "event" : "transport";
  return (
    <SafeAreaView style={s.safe}>
      <LinearGradient
        colors={
          kind === "event" ? gradients.eventSoft : gradients.transportSoft
        }
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={s.container}>
        <LinearGradient
          colors={kind === "event" ? gradients.event : gradients.transport}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>
              MEDICREW · {prefs.tr("organization").toUpperCase()}
            </Text>
            <Text style={s.title}>
              {company?.company_name || prefs.tr("organization")}
            </Text>
            <Text style={s.subtitle}>
              {kind === "event"
                ? "Event medical staffing network"
                : "Air medical transport staffing network"}
            </Text>
            <View style={s.kindPill}>
              <Text style={s.kindPillText}>
                {kind === "event" ? "LIVE EVENTS" : "AIR OPERATIONS"}
              </Text>
            </View>
          </View>
          <MissionIllustration kind={kind} size={104} />
          <Pressable
            onPress={() => router.push("/company-profile")}
            style={s.avatar}
          >
            {photo ? (
              <Image source={{ uri: photo }} style={s.avatarImage} />
            ) : (
              <Text style={s.avatarText}>CO</Text>
            )}
          </Pressable>
        </LinearGradient>
        {preview ? (
          <View style={s.preview}>
            <Text style={s.previewTitle}>DEVELOPMENT ACCOUNT</Text>
            <Text style={s.previewText}>
              No fake missions or profiles are displayed. Real network content
              appears from Supabase.
            </Text>
          </View>
        ) : null}
        {company && company.verification_status !== "verified" ? (
          <Pressable
            style={s.verification}
            onPress={() => router.push("/company-verification")}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.verificationTitle}>Verification required</Text>
              <Text style={s.verificationSub}>
                Upload official organization evidence before publishing
                assignments.
              </Text>
            </View>
            <Text style={s.arrow}>→</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.push("/company-mission")}>
          <LinearGradient
            colors={kind === "event" ? gradients.event : gradients.transport}
            style={s.create}
          >
            <View>
              <Text style={s.createTitle}>{prefs.tr("createAssignment")}</Text>
              <Text style={s.createSub}>
                {kind === "event"
                  ? "Event location · staffing · clinical requirements"
                  : "Departure airport · destination · clinical requirements"}
              </Text>
            </View>
            <Text style={s.createArrow}>→</Text>
          </LinearGradient>
        </Pressable>
        <View style={s.grid}>
          <Pressable
            style={s.action}
            onPress={() => router.push("/company-search")}
          >
            <OptionIllustration name="search" size={42} company />
            <Text style={s.actionTitle}>{prefs.tr("findProfessionals")}</Text>
            <Text style={s.actionSub}>{prefs.tr("companyNetwork")}</Text>
          </Pressable>
          <Pressable style={s.action} onPress={() => router.push("/network")}>
            <OptionIllustration name="network" size={42} company />
            <Text style={s.actionTitle}>{prefs.tr("network")}</Text>
            <Text style={s.actionSub}>{prefs.tr("companyNetwork")}</Text>
          </Pressable>
          <Pressable style={s.action} onPress={() => router.push("/messages")}>
            <OptionIllustration name="messages" size={42} company />
            <Text style={s.actionTitle}>{prefs.tr("messages")}</Text>
            <Text style={s.actionSub}>{prefs.tr("directConversations")}</Text>
          </Pressable>
          <Pressable
            style={s.action}
            onPress={() => router.push("/company-missions")}
          >
            <OptionIllustration name="work" size={42} company />
            <Text style={s.actionTitle}>{prefs.tr("assignments")}</Text>
            <Text style={s.actionSub}>{prefs.tr("openActiveHistory")}</Text>
          </Pressable>
        </View>
        {error ? (
          <View style={s.error}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : null}
        <Text style={s.section}>{prefs.tr("recentAssignments")}</Text>
        {loading ? (
          <ActivityIndicator color={colors.company} size="large" />
        ) : missions.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No assignments yet</Text>
            <Text style={s.meta}>
              Published assignments will appear here with real applicant
              activity.
            </Text>
          </View>
        ) : (
          missions.slice(0, 8).map((m) => {
            const amount = prefs.money(
              m.compensation_cents,
              m.compensation_currency || "EUR",
            );
            return (
              <Pressable
                key={m.id}
                style={[
                  s.card,
                  m.mission_kind === "event" ? s.eventCard : s.transportCard,
                ]}
                onPress={() =>
                  router.push({
                    pathname: "/company-candidates",
                    params: { missionId: m.id },
                  })
                }
              >
                <View style={s.row}>
                  <View
                    style={[
                      s.badge,
                      m.mission_kind === "event" && s.eventBadge,
                    ]}
                  >
                    <Text
                      style={[
                        s.badgeText,
                        m.mission_kind === "event" && s.eventBadgeText,
                      ]}
                    >
                      {m.mission_kind === "event" ? "EVENT" : "AIR TRANSPORT"}
                    </Text>
                  </View>
                  <Text style={s.status}>{m.status.replaceAll("_", " ")}</Text>
                </View>
                <Text style={s.route}>
                  {m.mission_kind === "event"
                    ? m.event_name || m.title
                    : `${m.departure_airport_code || m.departure_location} → ${m.arrival_airport_code || m.destination_location}`}
                </Text>
                <Text style={s.meta}>
                  {m.mission_kind === "event"
                    ? [m.event_city, m.event_country].filter(Boolean).join(", ")
                    : `${m.departure_location} → ${m.destination_location}`}{" "}
                  · {new Date(m.departure_at).toLocaleString(prefs.language)}
                </Text>
                <View style={s.bottom}>
                  <Text style={s.role}>
                    {m.professional_type === "nurse"
                      ? prefs.tr("nurse")
                      : prefs.tr("doctor")}
                  </Text>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={s.pay}>{amount.original}</Text>
                    {amount.display ? (
                      <Text style={s.converted}>{amount.display}</Text>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { flexGrow: 1, padding: 22, paddingBottom: 45 },
  hero: {
    minHeight: 170,
    borderRadius: 30,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: "#E9FFFA",
  },
  title: { fontSize: 28, fontWeight: "900", color: colors.white, marginTop: 5 },
  subtitle: { fontSize: 11, color: "#E9FFFA", marginTop: 5 },
  kindPill: {
    alignSelf: "flex-start",
    marginTop: 14,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF25",
  },
  kindPillText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.white,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 17,
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: "#FFFFFF35",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 50, height: 50 },
  avatarText: { color: colors.white, fontWeight: "900" },
  preview: {
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.companySoft,
    marginTop: 16,
  },
  previewTitle: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    color: colors.companyDark,
  },
  previewText: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    marginTop: 3,
  },
  verification: {
    marginTop: 13,
    padding: 15,
    borderRadius: radii.md,
    backgroundColor: colors.companySoft,
    flexDirection: "row",
    alignItems: "center",
  },
  verificationTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  verificationSub: { fontSize: 10.5, color: colors.muted, marginTop: 3 },
  arrow: { fontSize: 23, color: colors.companyDark },
  create: {
    marginTop: 14,
    borderRadius: radii.lg,
    padding: 19,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  createTitle: { fontSize: 18, fontWeight: "900", color: colors.white },
  createSub: { fontSize: 10.5, color: "#D8F1EB", marginTop: 4, maxWidth: 260 },
  createArrow: { fontSize: 27, color: colors.white },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9, marginTop: 10 },
  action: {
    width: "48.5%",
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    padding: 14,
  },
  actionIcon: { fontSize: 22, fontWeight: "900", color: colors.companyDark },
  actionTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: colors.ink,
    marginTop: 9,
  },
  actionSub: { fontSize: 10, color: colors.muted, marginTop: 3 },
  section: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.ink,
    marginTop: 26,
    marginBottom: 10,
  },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    marginBottom: 9,
  },
  transportCard: { backgroundColor: "#F8FFFD", borderColor: "#BFE7E1" },
  eventCard: { backgroundColor: "#FCF9FF", borderColor: "#DECDF5" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 7,
    backgroundColor: colors.companySoft,
  },
  badgeText: { fontSize: 8, fontWeight: "900", color: colors.companyDark },
  eventBadge: { backgroundColor: colors.eventSoft },
  eventBadgeText: { color: colors.eventDark },
  status: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.muted,
    textTransform: "capitalize",
  },
  route: { fontSize: 18, fontWeight: "900", color: colors.ink, marginTop: 10 },
  meta: { fontSize: 10.5, lineHeight: 16, color: colors.muted, marginTop: 4 },
  bottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  role: { fontSize: 12, fontWeight: "800", color: colors.ink },
  pay: { fontSize: 16, fontWeight: "900", color: colors.ink },
  converted: { fontSize: 9.5, color: colors.muted, marginTop: 2 },
  empty: {
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
  },
  emptyTitle: { fontSize: 15, fontWeight: "900", color: colors.ink },
  error: {
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: "#FDECEC",
    marginTop: 12,
  },
  errorText: { fontSize: 12, color: colors.danger },
});
