import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { supabase } from "../lib/supabase";
import { avatarUrl } from "../lib/avatar";
import { colors, radii } from "../lib/theme";
type Kind = "professional" | "company" | "reports";
export default function Admin() {
  const [loading, setLoading] = useState(true),
    [kind, setKind] = useState<Kind | null>(null),
    [openId, setOpenId] = useState(""),
    [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [professionals, setProfessionals] = useState<any[]>([]),
    [companies, setCompanies] = useState<any[]>([]),
    [profiles, setProfiles] = useState<any[]>([]),
    [proDocs, setProDocs] = useState<any[]>([]),
    [companyDocs, setCompanyDocs] = useState<any[]>([]),
    [reports, setReports] = useState<any[]>([]);
  useEffect(() => {
    void load();
  }, []);
  async function load() {
    if (!supabase) return setLoading(false);
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return setError("Sign in required");
    const me = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (me.data?.role !== "admin") {
      setError("Admin access required");
      setLoading(false);
      return;
    }
    const [pr, co, p, vq, cq, rq] = await Promise.all([
      supabase
        .from("professionals")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select(
          "id,first_name,last_name,email,phone,avatar_url,bio,headline,country,city",
        ),
      supabase.rpc("admin_verification_queue_v2"),
      supabase.rpc("admin_company_verification_queue"),
      supabase.rpc("admin_report_queue"),
    ]);
    const e =
      pr.error || co.error || p.error || vq.error || cq.error || rq.error;
    if (e) setError(e.message);
    else {
      setProfessionals(pr.data || []);
      setCompanies(co.data || []);
      setProfiles(p.data || []);
      setProDocs([
        ...(vq.data?.documents || []),
        ...(vq.data?.certifications || []).map((x: any) => ({
          ...x,
          document_type: "certificate",
          title: x.name,
        })),
      ]);
      setCompanyDocs(cq.data?.documents || []);
      setReports(rq.data || []);
    }
    setLoading(false);
  }
  const profile = (id: string) => profiles.find((x) => x.id === id) || {};
  const pendingPros = useMemo(
    () =>
      professionals.filter(
        (x) =>
          x.verification_status === "pending" ||
          proDocs.some((d) => d.professional_id === x.id),
      ),
    [professionals, proDocs],
  );
  const pendingCompanies = useMemo(
    () =>
      companies.filter(
        (x) =>
          x.verification_status === "pending" ||
          companyDocs.some((d) => d.company_id === x.id),
      ),
    [companies, companyDocs],
  );
  async function file(bucket: string, path: string) {
    if (!supabase) return;
    const { data, error: e } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 300);
    if (e) return Alert.alert("Document unavailable", e.message);
    if (data?.signedUrl) await Linking.openURL(data.signedUrl);
  }
  async function account(
    id: string,
    next: "verified" | "rejected",
    company = false,
  ) {
    if (!supabase) return;
    setBusy(id);
    try {
      const { error: e } = company
        ? await supabase.rpc("admin_verify_company", {
            p_company_id: id,
            p_status: next,
          })
        : await supabase.rpc("admin_verify_professional", {
            p_professional_id: id,
            p_status: next,
          });
      if (e) throw e;
      await load();
    } catch (e: any) {
      Alert.alert(
        "Impossible de valider le dossier",
        e?.message || "Une erreur inconnue est survenue.",
      );
    } finally {
      setBusy("");
    }
  }
  async function ban(report: any) {
    if (!supabase || !report.reported_id || report.reported_is_banned) return;
    const reason =
      `${reasonLabel(report.reason)} — ${report.explanation}`.slice(0, 500);
    const performBan = async () => {
      setBusy(report.id);
      const { error: e } = await supabase!.rpc("admin_permanently_ban_user", {
        p_profile_id: report.reported_id,
        p_reason: reason,
      });
      if (e) Alert.alert("Échec du bannissement", e.message);
      else {
        await supabase!.functions.invoke("dispatch-push-queue");
        await load();
      }
      setBusy("");
    };
    const detail = `${report.reported_name}\n\nRaison communiquée : ${reason}`;
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(`Bannir définitivement ce compte ?\n\n${detail}`)
      )
        await performBan();
      return;
    }
    Alert.alert("Bannir définitivement ce compte ?", detail, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Bannir définitivement",
        style: "destructive",
        onPress: performBan,
      },
    ]);
  }
  if (loading)
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ marginTop: 90 }} color={colors.company} />
      </SafeAreaView>
    );
  if (error)
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}>
          <Text style={s.title}>MediCrew Admin</Text>
          <Text style={s.muted}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.head}>
          <View>
            <Text style={s.eyebrow}>MEDICREW · ADMIN</Text>
            <Text style={s.title}>Dossiers</Text>
          </View>
          <View style={s.headActions}>
            <Pressable
              onPress={() => router.push("/preferences" as never)}
              style={s.settings}
            >
              <Text style={s.settingsText}>Paramètres</Text>
            </Pressable>
            <Pressable onPress={load} style={s.refresh}>
              <Text>↻</Text>
            </Pressable>
          </View>
        </View>
        <View style={s.choices}>
          <Choice
            title="Professionnels"
            count={pendingPros.length}
            active={kind === "professional"}
            onPress={() => setKind("professional")}
          />
          <Choice
            title="Entreprises"
            count={pendingCompanies.length}
            active={kind === "company"}
            onPress={() => setKind("company")}
          />
          <Choice
            title="Signalements"
            count={reports.filter((x) => x.status === "pending").length}
            active={kind === "reports"}
            onPress={() => setKind("reports")}
          />
        </View>
        {!kind ? (
          <View style={s.empty}>
            <Text style={s.muted}>
              Choisissez une catégorie pour afficher les dossiers.
            </Text>
          </View>
        ) : kind === "professional" ? (
          pendingPros.map((x) => (
            <Professional
              key={x.id}
              item={x}
              p={profile(x.id)}
              docs={proDocs.filter((d) => d.professional_id === x.id)}
              expanded={openId === x.id}
              toggle={() => setOpenId(openId === x.id ? "" : x.id)}
              busy={busy}
              file={file}
              account={account}
            />
          ))
        ) : kind === "company" ? (
          pendingCompanies.map((x) => (
            <Company
              key={x.id}
              item={x}
              p={profile(x.id)}
              docs={companyDocs.filter((d) => d.company_id === x.id)}
              expanded={openId === x.id}
              toggle={() => setOpenId(openId === x.id ? "" : x.id)}
              busy={busy}
              file={file}
              account={account}
            />
          ))
        ) : reports.length ? (
          reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              busy={busy === r.id}
              ban={() => ban(r)}
            />
          ))
        ) : (
          <View style={s.empty}>
            <Text style={s.muted}>Aucun signalement.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
function reasonLabel(reason: string) {
  return (
    (
      {
        harassment: "Harcèlement ou menaces",
        spam: "Spam",
        fraud: "Fraude ou arnaque",
        impersonation: "Usurpation d’identité",
        unsafe_behavior: "Comportement dangereux",
        inappropriate_content: "Contenu inapproprié",
        other: "Autre",
      } as Record<string, string>
    )[reason] || reason
  );
}
function ReportCard({
  report,
  busy,
  ban,
}: {
  report: any;
  busy: boolean;
  ban: () => void;
}) {
  return (
    <View style={s.reportCard}>
      <View style={s.reportTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.reportReason}>{reasonLabel(report.reason)}</Text>
          <Text style={s.muted}>
            {new Date(report.created_at).toLocaleString("fr-FR")} ·{" "}
            {report.status.toUpperCase()}
          </Text>
        </View>
        <View style={s.count}>
          <Text style={s.countText}>
            {report.report_count} signalement
            {report.report_count > 1 ? "s" : ""}
          </Text>
        </View>
      </View>
      <Text style={s.reportText}>{report.explanation}</Text>
      <View style={s.people}>
        <Text style={s.personLabel}>SIGNALÉ PAR</Text>
        <Text style={s.person}>
          {report.reporter_name} · {report.reporter_email || "email supprimé"}
        </Text>
        <Text style={s.personLabel}>COMPTE SIGNALÉ</Text>
        <Text style={s.person}>
          {report.reported_name} · {report.reported_email || "email supprimé"}
        </Text>
      </View>
      {report.reported_is_banned ? (
        <View style={s.banned}>
          <Text style={s.bannedText}>COMPTE DÉJÀ BANNI</Text>
        </View>
      ) : busy ? (
        <ActivityIndicator color={colors.danger} />
      ) : (
        <Pressable onPress={ban} style={s.ban}>
          <Text style={s.banText}>Bannir définitivement en 1 clic</Text>
        </Pressable>
      )}
    </View>
  );
}
function Choice({
  title,
  count,
  active,
  onPress,
}: {
  title: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[s.choice, active && s.choiceOn]}>
      <Text style={s.choiceCount}>{count}</Text>
      <Text style={s.choiceTitle}>{title}</Text>
      <Text style={s.muted}>Voir les dossiers →</Text>
    </Pressable>
  );
}
function Header({
  name,
  p,
  expanded,
  toggle,
}: {
  name: string;
  p: any;
  expanded: boolean;
  toggle: () => void;
}) {
  const img = avatarUrl(p.avatar_url);
  return (
    <Pressable onPress={toggle} style={s.accountHead}>
      {img ? (
        <Image source={{ uri: img }} style={s.logo} />
      ) : (
        <View style={s.logo} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{name}</Text>
        <Text style={s.muted}>
          {p.email || "Email manquant"} · {p.phone || "Téléphone manquant"}
        </Text>
      </View>
      <Text style={s.arrow}>{expanded ? "−" : "＋"}</Text>
    </Pressable>
  );
}
function Professional({
  item,
  p,
  docs,
  expanded,
  toggle,
  busy,
  file,
  account,
}: {
  item: any;
  p: any;
  docs: any[];
  expanded: boolean;
  toggle: () => void;
  busy: string;
  file: any;
  account: any;
}) {
  const name =
    [p.first_name, p.last_name].filter(Boolean).join(" ") || "Professionnel";
  return (
    <View style={s.account}>
      <Header name={name} p={p} expanded={expanded} toggle={toggle} />
      {expanded ? (
        <View style={s.details}>
          <Info
            text={`${item.professional_type || "—"} · ${item.years_experience || 0} ans d’expérience`}
          />
          <Info text={`Statut : ${item.verification_status || "—"}`} />
          <Info text={`Spécialité : ${item.specialty || "—"}`} />
          <Info
            text={`Langues parlées : ${item.spoken_languages?.join(", ") || "—"}`}
          />
          <Info text={`Nationalité : ${item.nationality || "—"}`} />
          <Info
            text={`Licence : ${item.license_number || "—"} · ${item.license_country || "—"} · ${item.license_authority || "—"}`}
          />
          <Info
            text={[
              `IATA ${item.base_airport_code || "—"}`,
              item.base_city,
              item.country_of_operation,
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          <Info text={p.bio || p.headline || "Aucun texte de présentation"} />
          {docs.map((d) => (
            <Doc
              key={d.id}
              d={d}
              open={() => file("professional-documents", d.storage_path)}
            />
          ))}
          <Actions
            busy={busy === item.id}
            reject={() => account(item.id, "rejected", false)}
            verify={() => account(item.id, "verified", false)}
          />
        </View>
      ) : null}
    </View>
  );
}
function Company({
  item,
  p,
  docs,
  expanded,
  toggle,
  busy,
  file,
  account,
}: {
  item: any;
  p: any;
  docs: any[];
  expanded: boolean;
  toggle: () => void;
  busy: string;
  file: any;
  account: any;
}) {
  return (
    <View style={s.account}>
      <Header
        name={item.company_name || "Entreprise"}
        p={p}
        expanded={expanded}
        toggle={toggle}
      />
      {expanded ? (
        <View style={s.details}>
          <Info text={item.address || "Adresse manquante"} />
          <Info text={`Statut : ${item.verification_status || "—"}`} />
          <Info text={`Représentant : ${item.contact_name || "—"}`} />
          <Info
            text={`Immatriculation : ${item.registration_country || "—"} · ${item.registration_number || "—"}`}
          />
          <Info text={`Site : ${item.website || "—"}`} />
          <Info text={p.bio || p.headline || "Aucun texte de présentation"} />
          <Info
            text={
              item.company_type === "event"
                ? "Médical événementiel"
                : "Transport médical"
            }
          />
          {docs.map((d) => (
            <Doc
              key={d.id}
              d={d}
              open={() => file("company-documents", d.storage_path)}
            />
          ))}
          <Actions
            busy={busy === item.id}
            reject={() => account(item.id, "rejected", true)}
            verify={() => account(item.id, "verified", true)}
          />
        </View>
      ) : null}
    </View>
  );
}
function Info({ text }: { text: string }) {
  return <Text style={s.info}>{text}</Text>;
}
function Doc({
  d,
  open,
}: {
  d: any;
  open: () => void;
}) {
  return (
    <View style={s.doc}>
      <View style={{ flex: 1 }}>
        <Text style={s.docTitle}>{label(d.document_type)}</Text>
        <Text style={s.muted}>{d.title}</Text>
      </View>
      {d.storage_path ? (
        <Pressable onPress={open} style={s.open}>
          <Text style={s.openText}>Ouvrir</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
function label(x: string) {
  return (
    (
      {
        passport: "Passeport",
        cv: "CV",
        professional_card: "Carte professionnelle",
        diploma: "Diplôme",
        bank_details: "RIB",
      } as any
    )[x] ||
    x?.replaceAll("_", " ") ||
    "Document"
  );
}
function Actions({
  busy,
  reject,
  verify,
}: {
  busy: boolean;
  reject: () => void;
  verify: () => void;
}) {
  return busy ? (
    <ActivityIndicator color={colors.company} />
  ) : (
    <View style={s.actions}>
      <Pressable onPress={reject} style={s.reject}>
        <Text style={s.rejectText}>Refuser le dossier</Text>
      </Pressable>
      <Pressable onPress={verify} style={s.verify}>
        <Text style={s.verifyText}>Accepter le dossier</Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { flexGrow: 1, padding: 22, paddingBottom: 50 },
  center: { flex: 1, justifyContent: "center", padding: 25 },
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: colors.company,
  },
  title: { fontSize: 34, fontWeight: "900", color: colors.ink, marginTop: 5 },
  refresh: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  headActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  settings: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsText: { color: colors.white, fontSize: 11, fontWeight: "900" },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22,
    marginBottom: 18,
  },
  choice: {
    flexGrow: 1,
    flexBasis: 220,
    padding: 17,
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
  },
  choiceOn: {
    borderColor: colors.company,
    backgroundColor: colors.companySoft,
  },
  choiceCount: { fontSize: 26, fontWeight: "900", color: colors.ink },
  choiceTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.ink,
    marginVertical: 5,
  },
  empty: {
    padding: 25,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  muted: { fontSize: 10.5, lineHeight: 16, color: colors.muted },
  account: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.white,
    marginBottom: 9,
    overflow: "hidden",
  },
  accountHead: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: colors.line,
  },
  name: { fontSize: 14, fontWeight: "900", color: colors.ink },
  arrow: { fontSize: 23, color: colors.companyDark },
  details: { padding: 15, borderTopWidth: 1, borderTopColor: colors.line },
  info: { fontSize: 11.5, lineHeight: 18, color: colors.ink, marginBottom: 5 },
  doc: {
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  docTitle: { fontSize: 12, fontWeight: "900", color: colors.ink },
  open: { padding: 8, borderRadius: 9, backgroundColor: colors.paper },
  openText: { fontSize: 9, fontWeight: "900", color: colors.ink },
  actions: {
    flexDirection: "row",
    gap: 5,
    justifyContent: "flex-end",
    marginTop: 8,
  },
  reject: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: "#FFF1F1",
  },
  rejectText: { fontSize: 9, fontWeight: "900", color: "#A33A3A" },
  verify: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: colors.companyDark,
  },
  verifyText: { fontSize: 9, fontWeight: "900", color: colors.white },
  reportCard: {
    padding: 17,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#E7C7C7",
    backgroundColor: colors.white,
    marginBottom: 10,
  },
  reportTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  reportReason: { fontSize: 15, fontWeight: "900", color: colors.danger },
  count: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: "#FFF1F1",
  },
  countText: { fontSize: 9, fontWeight: "900", color: "#A33A3A" },
  reportText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
    marginTop: 13,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.paper,
  },
  people: {
    marginTop: 13,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 10,
  },
  personLabel: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1,
    color: colors.muted,
    marginTop: 6,
  },
  person: {
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.ink,
    marginTop: 2,
  },
  ban: {
    height: 48,
    borderRadius: radii.md,
    backgroundColor: "#A33A3A",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  banText: { fontSize: 11, fontWeight: "900", color: colors.white },
  banned: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.line,
    alignItems: "center",
    marginTop: 14,
  },
  bannedText: { fontSize: 10, fontWeight: "900", color: colors.muted },
});
