import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors, gradients, radii, shadows } from "../lib/theme";
import { MediCrewLogo } from "../lib/brand";
import { usePreferences } from "../lib/preferences-context";
import { localize } from "../lib/i18n";
import { PreAuthPreferences } from "../lib/preauth-preferences";
import { AnimatedPressable as Pressable } from "../lib/animated-pressable";
import Head from "expo-router/head";

type Role = "professional" | "company";
export default function Welcome() {
  const prefs = usePreferences();
  const L = (en: string, fr: string, es: string) =>
    localize(prefs.language, en, fr, es);
  const [role, setRole] = useState<Role | null>(null);
  const { width } = useWindowDimensions();
  const wide = width >= 920;
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 55,
    }).start();
  }, [enter]);
  const palette =
    role === "company" ? gradients.company : gradients.professional;
  return (
    <SafeAreaView style={styles.safe}>
      <Head>
        <title>
          MediCrew | Medical missions for doctors, nurses and healthcare
          organizations
        </title>
        <meta
          name="description"
          content="MediCrew connects verified doctors and nurses with air-medical transport, repatriation and event healthcare organizations worldwide."
        />
        <meta
          name="keywords"
          content="medical missions, healthcare staffing, doctor missions, nurse missions, air medical transport, medical repatriation, event medical staffing, médecins missions, infirmiers missions"
        />
        <link rel="canonical" href="https://www.medicrew.app/" />
        <meta
          name="robots"
          content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
        />
      </Head>
      <LinearGradient
        colors={gradients.soft}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <Animated.View
            style={[
              styles.container,
              wide && styles.containerWide,
              {
                opacity: enter,
                transform: [
                  {
                    translateY: enter.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.intro, wide && styles.introWide]}>
              <View style={styles.top}>
                <MediCrewLogo />
                <PreAuthPreferences />
              </View>
              <View style={styles.badge}>
                <View style={styles.dot} />
                <Text style={styles.badgeText}>
                  {L(
                    "VERIFIED MEDICAL MISSION NETWORK",
                    "RÉSEAU DE MISSIONS MÉDICALES VÉRIFIÉ",
                    "RED VERIFICADA DE MISIONES MÉDICAS",
                  )}
                </Text>
              </View>
              <View style={styles.hero}>
                <Text style={styles.eyebrow}>
                  {L(
                    "CARE MOVES FORWARD",
                    "LES SOINS AVANCENT",
                    "LA ATENCIÓN AVANZA",
                  )}
                </Text>
                <Text style={[styles.title, wide && styles.titleWide]}>
                  {L(
                    "One network. Two sides of every mission.",
                    "Un réseau. Deux côtés de chaque mission.",
                    "Una red. Dos lados de cada misión.",
                  )}
                </Text>
                <Text style={styles.subtitle}>
                  {L(
                    "Verified doctors and nurses meet transport, repatriation and event organizations that need them.",
                    "Des médecins et infirmiers vérifiés rencontrent les organisations de transport, rapatriement et événementiel qui ont besoin d’eux.",
                    "Médicos y enfermeros verificados conectan con organizaciones de transporte, repatriación y eventos que los necesitan.",
                  )}
                </Text>
              </View>
            </View>
            <View style={[styles.selector, wide && styles.selectorWide]}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {L(
                    "Choose your side",
                    "Choisissez votre côté",
                    "Elige tu lado",
                  )}
                </Text>
                <RoleCard
                  role="professional"
                  selected={role === "professional"}
                  onPress={() => setRole("professional")}
                  language={prefs.language}
                />
                <RoleCard
                  role="company"
                  selected={role === "company"}
                  onPress={() => setRole("company")}
                  language={prefs.language}
                />
              </View>
              <Pressable
                disabled={!role}
                onPress={() =>
                  role && router.push({ pathname: "/auth", params: { role } })
                }
              >
                <LinearGradient
                  colors={palette}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={[styles.button, !role && styles.buttonDisabled]}
                >
                  <Text style={styles.buttonText}>
                    {role === "company"
                      ? L(
                          "Continue as company",
                          "Continuer comme entreprise",
                          "Continuar como empresa",
                        )
                      : role === "professional"
                        ? L(
                            "Continue as professional",
                            "Continuer comme professionnel",
                            "Continuar como profesional",
                          )
                        : L(
                            "Choose a side",
                            "Choisissez un côté",
                            "Elige un lado",
                          )}
                  </Text>
                  <Text style={styles.buttonArrow}>→</Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={() => router.push("/legal")}
                style={styles.legal}
              >
                <Text style={styles.legalText}>
                  {L(
                    "Privacy · Terms · Data policy",
                    "Confidentialité · Conditions · Données",
                    "Privacidad · Términos · Datos",
                  )}
                </Text>
              </Pressable>
              <Text style={styles.footer}>
                {L(
                  "MediCrew · Verified people. Safer missions.",
                  "MediCrew · Profils vérifiés. Missions plus sûres.",
                  "MediCrew · Personas verificadas. Misiones más seguras.",
                )}
              </Text>
            </View>
          </Animated.View>
          <View style={[styles.proof, wide && styles.proofWide]}>
            <Proof
              value="2"
              label={L(
                "clear account types",
                "parcours clairement séparés",
                "tipos de cuenta claros",
              )}
            />
            <Proof
              value="5"
              label={L(
                "professional documents",
                "documents professionnels",
                "documentos profesionales",
              )}
            />
            <Proof
              value="24h"
              label={L(
                "target review time",
                "délai de revue visé",
                "plazo de revisión previsto",
              )}
            />
          </View>
          <View style={styles.seoSection}>
            <Text style={styles.seoEyebrow}>
              {L(
                "BUILT FOR INTERNATIONAL MEDICAL OPERATIONS",
                "CONÇU POUR LES OPÉRATIONS MÉDICALES INTERNATIONALES",
                "CREADO PARA OPERACIONES MÉDICAS INTERNACIONALES",
              )}
            </Text>
            <Text style={styles.seoTitle}>
              {L(
                "From air-medical transport to event healthcare staffing.",
                "Du transport aéromédical au renfort médical événementiel.",
                "Del transporte aeromédico al personal sanitario para eventos.",
              )}
            </Text>
            <View style={[styles.seoCards, wide && styles.seoCardsWide]}>
              <SeoCard
                title={L(
                  "For doctors and nurses",
                  "Pour les médecins et infirmiers",
                  "Para médicos y enfermeros",
                )}
                text={L(
                  "Create a verified profile, publish availability and discover relevant medical assignments.",
                  "Créez un profil vérifié, publiez vos disponibilités et trouvez des missions médicales adaptées.",
                  "Crea un perfil verificado, publica tu disponibilidad y encuentra misiones médicas relevantes.",
                )}
              />
              <SeoCard
                title={L(
                  "For healthcare organizations",
                  "Pour les entreprises de santé",
                  "Para organizaciones sanitarias",
                )}
                text={L(
                  "Find verified professionals for repatriation, medical transport and event operations.",
                  "Trouvez des professionnels vérifiés pour le rapatriement, le transport médical et l’événementiel.",
                  "Encuentra profesionales verificados para repatriación, transporte médico y eventos.",
                )}
              />
              <SeoCard
                title={L(
                  "Private and controlled",
                  "Privé et contrôlé",
                  "Privado y controlado",
                )}
                text={L(
                  "Documents stay private, messaging is protected, and every account is reviewed before network access.",
                  "Les documents restent privés, la messagerie est protégée et chaque compte est contrôlé avant l’accès au réseau.",
                  "Los documentos siguen privados, la mensajería está protegida y cada cuenta se revisa antes del acceso.",
                )}
              />
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

function Proof({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.proofItem}>
      <Text style={styles.proofValue}>{value}</Text>
      <Text style={styles.proofLabel}>{label}</Text>
    </View>
  );
}

function SeoCard({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.seoCard}>
      <Text style={styles.seoCardTitle}>{title}</Text>
      <Text style={styles.seoCardText}>{text}</Text>
    </View>
  );
}

function RoleCard({
  role,
  selected,
  onPress,
  language,
}: {
  role: Role;
  selected: boolean;
  onPress: () => void;
  language: "en" | "fr" | "es";
}) {
  const company = role === "company";
  const L = (en: string, fr: string, es: string) =>
    localize(language, en, fr, es);
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.choice,
        company ? styles.companyChoice : styles.proChoice,
        selected && (company ? styles.companyActive : styles.proActive),
      ]}
    >
      <View
        style={[
          styles.illustrationWrap,
          { backgroundColor: company ? colors.companySoft : colors.proSoft },
        ]}
      >
        {company ? <CompanyIllustration /> : <ProIllustration />}
      </View>
      <View style={styles.choiceBody}>
        <Text
          style={[
            styles.roleTag,
            { color: company ? colors.companyDark : colors.proDark },
          ]}
        >
          {company
            ? L("ORGANIZATION", "ORGANISATION", "ORGANIZACIÓN")
            : L(
                "MEDICAL PROFESSIONAL",
                "PROFESSIONNEL MÉDICAL",
                "PROFESIONAL MÉDICO",
              )}
        </Text>
        <Text style={styles.choiceTitle}>
          {company
            ? L(
                "Company / event organization",
                "Entreprise / organisation événementielle",
                "Empresa / organización de eventos",
              )
            : L(
                "Doctor or nurse",
                "Médecin ou infirmier",
                "Médico o enfermero",
              )}
        </Text>
        <Text style={styles.choiceText}>
          {company
            ? L(
                "Transport, repatriation, event medical staffing",
                "Transport, rapatriement, médical événementiel",
                "Transporte, repatriación, personal médico para eventos",
              )
            : L(
                "Verified missions matched to your credentials",
                "Missions vérifiées adaptées à vos qualifications",
                "Misiones verificadas adaptadas a tus credenciales",
              )}
        </Text>
      </View>
      <Text
        style={[
          styles.chevron,
          { color: company ? colors.company : colors.pro },
        ]}
      >
        {selected ? "✓" : "›"}
      </Text>
    </Pressable>
  );
}
function ProIllustration() {
  return (
    <Svg width={58} height={58} viewBox="0 0 64 64">
      <Circle cx="32" cy="21" r="10" fill={colors.pro} />
      <Path
        d="M15 54c2-13 9-20 17-20s15 7 17 20"
        fill="none"
        stroke={colors.proDark}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Path
        d="M25 39c1 7 3 11 7 11s6-4 7-11"
        fill="none"
        stroke={colors.white}
        strokeWidth="3"
      />
      <Circle cx="48" cy="18" r="7" fill={colors.white} />
      <Path
        d="M48 14v8M44 18h8"
        stroke={colors.proDark}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
function CompanyIllustration() {
  return (
    <Svg width={58} height={58} viewBox="0 0 64 64">
      <Rect x="10" y="21" width="44" height="33" rx="8" fill={colors.company} />
      <Path
        d="M20 21v-7h24v7"
        stroke={colors.companyDark}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Rect x="18" y="30" width="10" height="8" rx="2" fill={colors.white} />
      <Rect x="36" y="30" width="10" height="8" rx="2" fill={colors.white} />
      <Path d="M32 43v11" stroke={colors.companyDark} strokeWidth="4" />
      <Circle cx="51" cy="17" r="8" fill={colors.white} />
      <Path
        d="M51 13v8M47 17h8"
        stroke={colors.companyDark}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  gradient: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 54 },
  container: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    padding: 22,
    paddingTop: 34,
    justifyContent: "center",
    gap: 22,
  },
  containerWide: {
    minHeight: 720,
    flexDirection: "row",
    alignItems: "center",
    gap: 72,
    paddingHorizontal: 54,
  },
  intro: { width: "100%" },
  introWide: { flex: 1.08 },
  selector: { width: "100%" },
  selectorWide: { flex: 0.92 },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#CBEBDD",
    backgroundColor: "#F5FFF8",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  badgeText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
    color: colors.greenDark,
  },
  hero: { marginTop: 18 },
  eyebrow: {
    color: colors.greenDark,
    fontWeight: "900",
    letterSpacing: 1.5,
    fontSize: 11,
    marginBottom: 9,
  },
  title: {
    fontSize: 36,
    lineHeight: 41,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -1.45,
  },
  titleWide: { fontSize: 52, lineHeight: 56, letterSpacing: -2.1 },
  subtitle: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: 15,
    borderWidth: 1,
    borderColor: colors.line,
    ...shadows.card,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: colors.ink,
    marginBottom: 3,
  },
  choice: {
    padding: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  proChoice: { borderColor: "#CFE9DF", backgroundColor: "#FBFEFC" },
  companyChoice: { borderColor: "#D4E6E2", backgroundColor: "#FBFDFC" },
  proActive: { borderColor: colors.pro, backgroundColor: colors.proSoft },
  companyActive: {
    borderColor: colors.company,
    backgroundColor: colors.companySoft,
  },
  illustrationWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  choiceBody: { flex: 1 },
  roleTag: { fontSize: 8, fontWeight: "900", letterSpacing: 0.9 },
  choiceTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: colors.ink,
    marginTop: 3,
  },
  choiceText: {
    fontSize: 10.5,
    lineHeight: 15,
    color: colors.muted,
    marginTop: 3,
  },
  chevron: { fontSize: 28, fontWeight: "700" },
  button: {
    height: 58,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 12,
    overflow: "hidden",
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.35 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: "900" },
  buttonArrow: { color: colors.white, fontSize: 22, fontWeight: "900" },
  legal: { alignItems: "center", paddingTop: 10 },
  legalText: { fontSize: 10, color: colors.greenDark, fontWeight: "800" },
  footer: {
    textAlign: "center",
    color: colors.muted,
    fontSize: 11,
    marginTop: 6,
  },
  proof: {
    width: "100%",
    maxWidth: 1072,
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 22,
    gap: 10,
  },
  proofWide: { justifyContent: "center" },
  proofItem: {
    flexGrow: 1,
    flexBasis: 180,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,.76)",
    borderWidth: 1,
    borderColor: "#D8E9E1",
    alignItems: "center",
  },
  proofValue: { fontSize: 25, fontWeight: "900", color: colors.greenDark },
  proofLabel: {
    marginTop: 4,
    fontSize: 10.5,
    fontWeight: "800",
    color: colors.muted,
    textAlign: "center",
  },
  seoSection: {
    width: "100%",
    maxWidth: 1120,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 72,
  },
  seoEyebrow: {
    textAlign: "center",
    color: colors.greenDark,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "900",
  },
  seoTitle: {
    maxWidth: 760,
    alignSelf: "center",
    marginTop: 9,
    color: colors.ink,
    fontSize: 31,
    lineHeight: 37,
    letterSpacing: -0.8,
    textAlign: "center",
    fontWeight: "900",
  },
  seoCards: { marginTop: 25, gap: 12 },
  seoCardsWide: { flexDirection: "row" },
  seoCard: {
    flex: 1,
    padding: 22,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  seoCardTitle: { color: colors.ink, fontSize: 16, fontWeight: "900" },
  seoCardText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 7,
  },
});
