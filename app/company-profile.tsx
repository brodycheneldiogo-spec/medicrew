import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { colors, radii } from "../lib/theme";
import { supabase } from "../lib/supabase";
import { avatarUrl, chooseAndUploadAvatar } from "../lib/avatar";
import { usePreferences } from "../lib/preferences-context";
import { confirmAccountDeletion } from "../lib/account-actions";
export default function CompanyProfile() {
  const prefs = usePreferences();
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [uploading, setUploading] = useState(false),
    [preview, setPreview] = useState(false),
    [profile, setProfile] = useState<any>(null),
    [company, setCompany] = useState<any>(null),
    [name, setName] = useState(""),
    [contact, setContact] = useState(""),
    [address, setAddress] = useState(""),
    [headline, setHeadline] = useState(""),
    [bio, setBio] = useState(""),
    [website, setWebsite] = useState("");
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
      if (__DEV__) setPreview(true);
      setLoading(false);
      return;
    }
    const [{ data: p, error: pe }, { data: c, error: ce }] = await Promise.all([
      supabase
        .from("profiles")
        .select("avatar_url,email,phone,headline,bio,city,country")
        .eq("id", user.id)
        .single(),
      supabase
        .from("companies")
        .select(
          "company_name,contact_name,address,company_type,verification_status,registration_country,registration_number,website",
        )
        .eq("id", user.id)
        .single(),
    ]);
    if (pe || ce) {
      Alert.alert(
        "Profile unavailable",
        (pe || ce)?.message || "Unknown error",
      );
      setLoading(false);
      return;
    }
    setProfile(p);
    setCompany(c);
    setName(c.company_name || "");
    setContact(c.contact_name || "");
    setAddress(c.address || "");
    setHeadline(p.headline || "");
    setBio(p.bio || "");
    setWebsite(c.website || "");
    setLoading(false);
  }
  async function save() {
    if (!supabase || preview) return;
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expired");
      if (!name.trim()) throw new Error("Organization name is required");
      const [a, b] = await Promise.all([
        supabase
          .from("companies")
          .update({
            company_name: name.trim(),
            contact_name: contact.trim() || null,
            address: address.trim() || null,
            website: website.trim() || null,
          })
          .eq("id", user.id),
        supabase
          .from("profiles")
          .update({
            headline: headline.trim() || null,
            bio: bio.trim() || null,
          })
          .eq("id", user.id),
      ]);
      if (a.error || b.error) throw a.error || b.error;
      Alert.alert("Saved", "Organization profile updated.");
    } catch (e: any) {
      Alert.alert("Save failed", e?.message || "Unable to save");
    } finally {
      setSaving(false);
    }
  }
  async function upload() {
    if (!supabase || preview)
      return Alert.alert(
        "Development account",
        "Logo upload uses a real authenticated organization account.",
      );
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expired");
      const path = await chooseAndUploadAvatar(
        user.id,
        profile?.avatar_url || null,
      );
      if (path) setProfile((x: any) => ({ ...x, avatar_url: path }));
    } catch (e: any) {
      Alert.alert("Logo upload failed", e?.message || "Unable to update logo");
    } finally {
      setUploading(false);
    }
  }
  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/auth");
  }
  if (loading)
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator style={{ marginTop: 80 }} color={colors.company} />
      </SafeAreaView>
    );
  const photo = avatarUrl(profile?.avatar_url),
    initials = (name || prefs.tr("organization")).slice(0, 2).toUpperCase();
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <Pressable onPress={() => router.back()}>
          <Text style={s.back}>‹ {prefs.tr("organization")}</Text>
        </Pressable>
        <Text style={s.eyebrow}>
          MEDICREW · {prefs.tr("organization").toUpperCase()}
        </Text>
        <Text style={s.title}>Your public identity.</Text>
        <Text style={s.sub}>
          This information is visible to verified MediCrew members and helps
          professionals understand who is hiring them.
        </Text>
        {preview ? (
          <View style={s.info}>
            <Text style={s.infoText}>
              Development account: real profile editing requires authentication.
            </Text>
          </View>
        ) : null}
        <View style={s.identity}>
          {photo ? (
            <Image source={{ uri: photo }} style={s.logo} />
          ) : (
            <View style={[s.logo, s.logoFallback]}>
              <Text style={s.logoText}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{name || prefs.tr("organization")}</Text>
            <Text style={s.type}>
              {company?.company_type === "event"
                ? "Event medical staffing"
                : "Medical transport"}
            </Text>
            <Text style={s.status}>
              {company?.verification_status === "verified"
                ? "✓ Verified organization"
                : String(company?.verification_status || "Not verified")}
            </Text>
          </View>
        </View>
        <Pressable onPress={upload} disabled={uploading} style={s.photoButton}>
          <Text style={s.photoButtonText}>
            {uploading ? "Uploading…" : "Change company logo"}
          </Text>
        </Pressable>
        <View style={s.card}>
          <Field label="Legal organization name" value={name} set={setName} />
          <Field
            label="Public headline"
            value={headline}
            set={setHeadline}
            placeholder="Air medical repatriation across Europe"
          />
          <Field
            label="About"
            value={bio}
            set={setBio}
            placeholder="Describe your organization, operations and values…"
            multiline
          />
          <Field
            label="MediCrew representative — first and last name"
            value={contact}
            set={setContact}
          />
          <Field label="Registered address" value={address} set={setAddress} />
          <Field label="Website" value={website} set={setWebsite} cap="none" />
          <Row
            label="Registration jurisdiction"
            value={company?.registration_country || "—"}
          />
          <Row
            label="Local legal entity identifier"
            value={company?.registration_number || "—"}
          />
          <Row label="Public email" value={profile?.email || "—"} />
        </View>
        <Pressable
          onPress={() => router.push("/preferences" as never)}
          style={s.preferences}
        >
          <View>
            <Text style={s.preferencesTitle}>{prefs.tr("settings")}</Text>
            <Text style={s.preferencesSub}>{prefs.tr("settingsHint")}</Text>
          </View>
          <Text style={s.preferencesValue}>
            {prefs.language.toUpperCase()} · {prefs.currency} →
          </Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={saving || preview}
          style={[s.primary, (saving || preview) && { opacity: 0.45 }]}
        >
          <Text style={s.primaryText}>
            {saving ? "Saving…" : "Save profile"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => confirmAccountDeletion(() => router.replace("/"))}
          style={s.logout}
        >
          <Text style={s.logoutText}>Delete account</Text>
        </Pressable>
        <Pressable onPress={logout} style={s.logout}>
          <Text style={s.logoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
function Field({
  label,
  value,
  set,
  placeholder = "",
  multiline = false,
  cap = "words",
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  cap?: any;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={set}
        placeholder={placeholder}
        autoCapitalize={cap}
        multiline={multiline}
        style={[s.input, multiline && s.multi]}
      />
    </View>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { flexGrow: 1, padding: 22, paddingBottom: 45 },
  back: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 23,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
    color: colors.company,
  },
  title: { fontSize: 34, fontWeight: "900", color: colors.ink, marginTop: 6 },
  sub: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 7 },
  info: {
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.companySoft,
    marginTop: 15,
  },
  infoText: { fontSize: 11, color: colors.companyDark },
  identity: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    marginTop: 20,
  },
  logo: { width: 76, height: 76, borderRadius: 22 },
  logoFallback: {
    backgroundColor: colors.companySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { fontSize: 18, fontWeight: "900", color: colors.companyDark },
  name: { fontSize: 21, fontWeight: "900", color: colors.ink },
  type: { fontSize: 11.5, color: colors.muted, marginTop: 3 },
  status: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.companyDark,
    marginTop: 5,
  },
  photoButton: {
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  photoButtonText: { fontSize: 12, fontWeight: "800", color: colors.ink },
  card: {
    marginTop: 16,
    padding: 17,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  field: { marginBottom: 12 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted,
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.paper,
    color: colors.ink,
  },
  multi: { height: 100, textAlignVertical: "top", paddingTop: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  rowLabel: { fontSize: 11.5, color: colors.muted },
  rowValue: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "right",
  },
  preferences: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  preferencesTitle: { fontSize: 13, fontWeight: "900", color: colors.ink },
  preferencesSub: { fontSize: 10, color: colors.muted, marginTop: 3 },
  preferencesValue: {
    fontSize: 10.5,
    fontWeight: "900",
    color: colors.companyDark,
  },
  primary: {
    height: 54,
    borderRadius: radii.md,
    backgroundColor: colors.companyDark,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
  },
  primaryText: { fontSize: 14, fontWeight: "900", color: colors.white },
  secondary: {
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
  },
  secondaryText: { fontSize: 13, fontWeight: "800", color: colors.ink },
  logout: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#E4B4B4",
    backgroundColor: "#FFF7F7",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
  },
  logoutText: { fontSize: 13, fontWeight: "900", color: "#A33A3A" },
});
