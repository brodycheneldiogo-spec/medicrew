import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { FontAwesome } from "@expo/vector-icons";
import { colors, radii } from "../lib/theme";
import { MediCrewLogo } from "../lib/brand";
import { supabase } from "../lib/supabase";
import { usePreferences } from "../lib/preferences-context";
import { localize } from "../lib/i18n";
import { PreAuthPreferences } from "../lib/preauth-preferences";
const webUrl = (path: string) =>
  typeof window === "undefined"
    ? path
    : new URL(path, window.location.origin).toString();
const ADMIN_EMAIL = "work.medicrew.app@gmail.com";
const TEST_EMAIL = "brodycheneldiogo@gmail.com";
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const strong = (v: string) =>
  v.length >= 8 && /[A-Z]/.test(v) && /[a-z]/.test(v) && /\d/.test(v);
const isAdminEmail = (value?: string | null) =>
  value?.trim().toLowerCase() === ADMIN_EMAIL;
function client() {
  if (supabase) return supabase;
  Alert.alert(
    "Supabase not configured",
    "Add the Expo public Supabase URL/key and restart Expo.",
  );
  return null;
}
async function routeAuthenticated(c: NonNullable<typeof supabase>) {
  const { data, error } = await c.rpc("my_account_access_state");
  if (!error && data) {
    const state = data as { role?: string; status?: string; allowed?: boolean };
    if (state.status === "banned") return router.replace("/banned" as never);
    if (state.role === "admin") return router.replace("/admin");
    if (state.allowed === false)
      return router.replace("/pending-review" as never);
    return router.replace(state.role === "company" ? "/company" : "/home");
  }
  const {
    data: { user },
  } = await c.auth.getUser();
  const { data: p } = user
    ? await c.from("profiles").select("role").eq("id", user.id).maybeSingle()
    : { data: null };
  router.replace(
    p?.role === "company"
      ? "/company"
      : p?.role === "admin"
        ? "/admin"
        : "/home",
  );
}
async function recordLegal(
  c: NonNullable<typeof supabase>,
  _profileId: string,
) {
  const { error } = await c.rpc("accept_current_legal_terms");
  if (error) throw error;
}
async function sendEmailCode(c: NonNullable<typeof supabase>, email: string) {
  const { error } = await c.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}
async function routeTestAccount(
  c: NonNullable<typeof supabase>,
  role: "professional" | "company",
) {
  const { data, error } = await c.rpc("switch_designated_test_role", {
    p_role: role,
  });
  if (error) throw error;
  const state = data as { needs_onboarding?: boolean } | null;
  router.replace(
    state?.needs_onboarding
      ? "/onboarding?role=" + role
      : role === "company"
        ? "/company"
        : "/home",
  );
}

export default function Auth() {
  const prefs = usePreferences();
  const L = (en: string, fr: string, es: string) =>
    localize(prefs.language, en, fr, es);
  const { role: requestedRole } = useLocalSearchParams<{
    role?: "professional" | "company";
  }>();
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const role = requestedRole || "professional";

  async function finishSignup() {
    const c = client();
    if (!c) return;
    const em = email.trim().toLowerCase();
    if (!validEmail(em))
      return Alert.alert(
        L("Email required", "Email requis", "Email obligatorio"),
      );
    if (!strong(password))
      return Alert.alert(
        L(
          "Password too weak",
          "Mot de passe trop faible",
          "Contraseña demasiado débil",
        ),
        L(
          "Use 8+ characters with uppercase, lowercase and a number.",
          "Utilisez 8+ caractères avec majuscule, minuscule et chiffre.",
          "Usa 8+ caracteres con mayúscula, minúscula y número.",
        ),
      );
    setLoading(true);
    try {
      const signupRole = isAdminEmail(em) ? "admin" : role;
      const { data, error } = await c.auth.signUp({
        email: em,
        password,
        options: {
          data: {
            role: signupRole,
            signup_complete: true,
            legal_accepted: true,
            terms_version: "2.1",
            privacy_version: "1.2",
            data_policy_version: "1.1",
            preferred_language: prefs.language,
            preferred_currency: prefs.currency,
          },
        },
      });
      if (error) throw error;
      if (data.session && data.user && isAdminEmail(data.user.email)) {
        await c
          .from("profiles")
          .update({
            email: em,
            role: "admin",
            preferred_language: prefs.language,
            preferred_currency: prefs.currency,
          })
          .eq("id", data.user.id);
        return router.replace("/admin");
      }
      if (data.session && data.user && em === TEST_EMAIL) {
        await recordLegal(c, data.user.id);
        return await routeTestAccount(c, role);
      }
      const destination =
        role === "company"
          ? "/onboarding?role=company"
          : "/onboarding?role=professional";
      if (data.session && data.user) {
        const profile = await c
          .from("profiles")
          .update({
            email: em,
            role,
            preferred_language: prefs.language,
            preferred_currency: prefs.currency,
          })
          .eq("id", data.user.id);
        if (profile.error) throw profile.error;
        await recordLegal(c, data.user.id);
        await sendEmailCode(c, em);
        return router.replace({
          pathname: "/verify-email",
          params: { email: em, returnTo: destination, flow: "google" },
        } as never);
      }
      router.replace({
        pathname: "/verify-email",
        params: { email: em, returnTo: destination, flow: "signup" },
      } as never);
    } catch (e: any) {
      Alert.alert(
        L(
          "Could not create account",
          "Impossible de créer le compte",
          "No se pudo crear la cuenta",
        ),
        e?.message || "MediCrew",
      );
    } finally {
      setLoading(false);
    }
  }

  async function emailSignIn() {
    const c = client();
    if (!c) return;
    const em = email.trim().toLowerCase();
    if (!validEmail(em) || !password)
      return Alert.alert(
        L(
          "Email and password required",
          "Email et mot de passe requis",
          "Email y contraseña obligatorios",
        ),
      );
    setLoading(true);
    const { data, error } = await c.auth.signInWithPassword({
      email: em,
      password,
    });
    setLoading(false);
    if (error)
      return Alert.alert(
        L("Sign in failed", "Connexion échouée", "Error al iniciar sesión"),
        error.message,
      );
    if (isAdminEmail(data.user.email)) return await routeAuthenticated(c);
    if (em === TEST_EMAIL) {
      try {
        return await routeTestAccount(c, role);
      } catch (e: any) {
        return Alert.alert(
          "MediCrew",
          e?.message || "Unable to open test account",
        );
      }
    }
    if (!data.user.email_confirmed_at)
      return router.replace({
        pathname: "/verify-email",
        params: { email: em, returnTo: "/pending-review", flow: "signup" },
      } as never);
    await routeAuthenticated(c);
  }

  async function google() {
    const c = client();
    if (!c) return;
    setGoogleBusy(true);
    try {
      const { data, error } = await c.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: webUrl("/auth/callback"),
          skipBrowserRedirect: false,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error)
        throw error || new Error("Could not start Google authentication");
      // The browser now leaves this page. The callback completes PKCE and routes
      // the authenticated user after validating the account state server-side.
      if (!data?.url) throw new Error("Could not start Google authentication");
    } catch (e: any) {
      Alert.alert(
        L(
          "Google authentication failed",
          "Authentification Google échouée",
          "Falló la autenticación con Google",
        ),
        e?.message ||
          L("Please try again.", "Réessayez.", "Inténtalo de nuevo."),
      );
    } finally {
      setGoogleBusy(false);
    }
  }

  const googleLabel = googleBusy
    ? L("Opening Google…", "Ouverture de Google…", "Abriendo Google…")
    : L(
        mode === "signup"
          ? "Create account with Google"
          : "Continue with Google",
        mode === "signup"
          ? "Créer le compte avec Google"
          : "Continuer avec Google",
        mode === "signup" ? "Crear cuenta con Google" : "Continuar con Google",
      );
  const legalCopy = (
    <Pressable style={s.legalNotice} onPress={() => router.push("/legal")}>
      <Text style={s.legalText}>
        {L(
          "By creating an account, you agree to MediCrew’s Terms, Privacy Policy and Data Policy.",
          "En créant un compte, vous acceptez les Conditions, la Politique de confidentialité et la Politique des données de MediCrew.",
          "Al crear una cuenta, aceptas los Términos, la Política de privacidad y la Política de datos de MediCrew.",
        )}
      </Text>
      <Text style={s.legalLink}>
        {L(
          "Trust & Privacy →",
          "Confiance & confidentialité →",
          "Confianza y privacidad →",
        )}
      </Text>
    </Pressable>
  );
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={s.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.top}>
            <Pressable onPress={() => router.back()}>
              <Text style={s.back}>‹ {prefs.tr("back")}</Text>
            </Pressable>
            <PreAuthPreferences />
          </View>
          <MediCrewLogo />
          <Text style={s.progress}>
            {mode === "signup"
              ? L("CREATE ACCOUNT", "CRÉER UN COMPTE", "CREAR CUENTA")
              : L("SECURE SIGN IN", "CONNEXION SÉCURISÉE", "INICIO SEGURO")}
          </Text>
          <Text style={s.title}>
            {mode === "signup"
              ? L("Join MediCrew.", "Rejoignez MediCrew.", "Únete a MediCrew.")
              : L(
                  "Sign in to MediCrew.",
                  "Connectez-vous à MediCrew.",
                  "Inicia sesión en MediCrew.",
                )}
          </Text>
          <Text style={s.sub}>
            {mode === "signup"
              ? L(
                  "Create your account with email or Google. An 8-digit code will verify your email before your profile can continue.",
                  "Créez votre compte avec votre email ou Google. Un code à 8 chiffres vérifiera votre email avant de continuer.",
                  "Crea tu cuenta con email o Google. Un código de 8 dígitos verificará tu email antes de continuar.",
                )
              : L(
                  "Use your email and password or continue securely with Google.",
                  "Utilisez votre email et mot de passe ou continuez de façon sécurisée avec Google.",
                  "Usa tu email y contraseña o continúa de forma segura con Google.",
                )}
          </Text>
          <View style={s.form}>
            <Field
              label={L("Email address", "Adresse email", "Correo electrónico")}
              value={email}
              set={setEmail}
            />
            <Text style={s.label}>
              {L("Password", "Mot de passe", "Contraseña")}
            </Text>
            <Password
              value={password}
              set={setPassword}
              show={show}
              setShow={setShow}
              labels={[
                L("Show", "Afficher", "Mostrar"),
                L("Hide", "Masquer", "Ocultar"),
              ]}
            />
            {mode === "signup" ? (
              <>
                <Text style={s.rules}>
                  {strong(password)
                    ? L(
                        "✓ Strong password",
                        "✓ Mot de passe fort",
                        "✓ Contraseña segura",
                      )
                    : L(
                        "8+ characters, uppercase, lowercase and a number.",
                        "8+ caractères, majuscule, minuscule et chiffre.",
                        "8+ caracteres, mayúscula, minúscula y número.",
                      )}
                </Text>
                <Pressable disabled={loading} onPress={finishSignup}>
                  <LinearGradient
                    colors={[colors.greenStart, colors.green, colors.greenEnd]}
                    style={s.button}
                  >
                    <Text style={s.buttonText}>
                      {loading
                        ? L(
                            "Creating account…",
                            "Création du compte…",
                            "Creando cuenta…",
                          )
                        : L(
                            "Create account with email",
                            "Créer avec email",
                            "Crear con email",
                          )}
                    </Text>
                  </LinearGradient>
                </Pressable>
                <GoogleButton
                  busy={googleBusy}
                  onPress={google}
                  label={googleLabel}
                />
                {legalCopy}
                <Pressable style={s.switch} onPress={() => setMode("signin")}>
                  <Text style={s.switchText}>
                    {L(
                      "Already have an account? Sign in",
                      "Déjà un compte ? Se connecter",
                      "¿Ya tienes cuenta? Inicia sesión",
                    )}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable disabled={loading} onPress={emailSignIn}>
                  <LinearGradient
                    colors={[colors.greenStart, colors.green, colors.greenEnd]}
                    style={s.button}
                  >
                    <Text style={s.buttonText}>
                      {loading
                        ? L("Signing in…", "Connexion…", "Iniciando sesión…")
                        : L("Sign in", "Se connecter", "Iniciar sesión")}
                    </Text>
                  </LinearGradient>
                </Pressable>
                <GoogleButton
                  busy={googleBusy}
                  onPress={google}
                  label={googleLabel}
                />
                <Pressable
                  style={s.switch}
                  onPress={() => router.push("/forgot-password")}
                >
                  <Text style={s.switchText}>
                    {L(
                      "Forgot your password?",
                      "Mot de passe oublié ?",
                      "¿Olvidaste tu contraseña?",
                    )}
                  </Text>
                </Pressable>
                <Pressable style={s.switch} onPress={() => setMode("signup")}>
                  <Text style={s.switchText}>
                    {L(
                      "Create an account",
                      "Créer un compte",
                      "Crear una cuenta",
                    )}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
function Field({
  label,
  value,
  set,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={set}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        style={s.input}
      />
    </View>
  );
}
function Password({
  value,
  set,
  show,
  setShow,
  labels,
}: {
  value: string;
  set: (v: string) => void;
  show: boolean;
  setShow: (v: boolean) => void;
  labels: [string, string];
}) {
  return (
    <View style={s.password}>
      <TextInput
        value={value}
        onChangeText={set}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete="password"
        style={s.passwordInput}
      />
      <Pressable onPress={() => setShow(!show)}>
        <Text style={s.eye}>{show ? labels[1] : labels[0]}</Text>
      </Pressable>
    </View>
  );
}
function GoogleButton({
  busy,
  onPress,
  label,
}: {
  busy: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable disabled={busy} onPress={onPress} style={s.google}>
      <FontAwesome name="google" size={17} color="#202124" />
      <Text style={s.googleText}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: 22, paddingBottom: 45 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  back: { fontSize: 15, fontWeight: "800", color: colors.ink },
  progress: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: colors.greenDark,
    marginTop: 16,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: colors.ink,
    marginTop: 7,
    lineHeight: 39,
  },
  sub: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 8 },
  form: { marginTop: 25 },
  field: { marginBottom: 15 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 7,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  password: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
  },
  eye: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.greenDark,
    paddingHorizontal: 14,
  },
  rules: {
    fontSize: 10.5,
    color: colors.muted,
    marginTop: 7,
    marginBottom: 10,
  },
  button: {
    height: 54,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  buttonText: { fontSize: 14, fontWeight: "900", color: colors.white },
  google: {
    height: 54,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 10,
  },
  googleText: { fontSize: 13, fontWeight: "800", color: "#202124" },
  switch: { paddingVertical: 14, alignItems: "center" },
  switchText: { fontSize: 12, fontWeight: "800", color: colors.greenDark },
  legalNotice: {
    paddingVertical: 13,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  legalText: {
    fontSize: 10.5,
    lineHeight: 16,
    color: colors.muted,
    textAlign: "center",
  },
  legalLink: {
    marginTop: 5,
    fontSize: 11,
    fontWeight: "900",
    color: colors.greenDark,
  },
});
