import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
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
import { router, useLocalSearchParams } from "expo-router";
import { colors, gradients, radii } from "../lib/theme";
import { supabase } from "../lib/supabase";
import { avatarUrl, chooseAndUploadAvatar } from "../lib/avatar";
import { usePreferences } from "../lib/preferences-context";
import { localize } from "../lib/i18n";

type CompanyType = "transport" | "event";
export default function Onboarding() {
  const prefs = usePreferences();
  const L = (en: string, fr: string, es: string) =>
    localize(prefs.language, en, fr, es);
  const { role } = useLocalSearchParams<{
    role?: "professional" | "company";
  }>();
  const professional = role !== "company";
  const [step, setStep] = useState(0),
    [type, setType] = useState<"doctor" | "nurse">("doctor"),
    [companyType, setCompanyType] = useState<CompanyType>("transport");
  const [name, setName] = useState(""),
    [bio, setBio] = useState(""),
    [specialty, setSpecialty] = useState(""),
    [spokenLanguages, setSpokenLanguages] = useState<string[]>([]),
    [years, setYears] = useState(""),
    [license, setLicense] = useState(""),
    [licenseCountry, setLicenseCountry] = useState(""),
    [licenseAuthority, setLicenseAuthority] = useState(""),
    [nationality, setNationality] = useState(""),
    [city, setCity] = useState(""),
    [country, setCountry] = useState(""),
    [airport, setAirport] = useState("");
  const [registrationCountry, setRegistrationCountry] = useState(""),
    [registrationNumber, setRegistrationNumber] = useState(""),
    [contact, setContact] = useState(""),
    [address, setAddress] = useState(""),
    [website, setWebsite] = useState(""),
    [phoneCode, setPhoneCode] = useState("+33"),
    [phone, setPhone] = useState("");
  const [photo, setPhoto] = useState<string | null>(null),
    [saving, setSaving] = useState(false),
    [formError, setFormError] = useState("");
  const total = professional ? 3 : 4;
  async function photoPick() {
    if (!supabase) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return Alert.alert(
        L(
          "Sign in required",
          "Connexion requise",
          "Inicio de sesión obligatorio",
        ),
      );
    try {
      const path = await chooseAndUploadAvatar(user.id, photo);
      if (path) setPhoto(path);
    } catch (e: any) {
      Alert.alert(
        L("Upload failed", "Échec de l’envoi", "Falló la carga"),
        e?.message || "MediCrew",
      );
    }
  }
  function validate() {
    if (professional) {
      if (step === 0 && (!name.trim() || !bio.trim()))
        return L(
          "Add your legal name and a short bio.",
          "Ajoutez votre nom légal et une courte bio.",
          "Añade tu nombre legal y una breve bio.",
        );
      if (
        step === 1 &&
        (!years.trim() || !specialty.trim() || spokenLanguages.length === 0)
      )
        return L(
          "Add your specialty, experience and at least one spoken language.",
          "Ajoutez votre spécialité, votre expérience et au moins une langue parlée.",
          "Añade tu especialidad, experiencia y al menos un idioma hablado.",
        );
      if (
        step === 2 &&
        (!city.trim() ||
          !country.trim() ||
          !airport.trim() ||
          !/^\+[1-9]\d{0,2}$/.test(phoneCode) ||
          phone.replace(/\D/g, "").length < 7)
      )
        return L(
          "City, country, IATA airport and phone are required.",
          "Ville, pays, aéroport IATA et téléphone requis.",
          "Se requieren ciudad, país, aeropuerto IATA y teléfono.",
        );
    } else {
      if (step === 0 && (!name.trim() || !bio.trim()))
        return L(
          "Add the organization name and a short bio.",
          "Ajoutez le nom de l’organisation et une courte bio.",
          "Añade el nombre de la organización y una breve bio.",
        );
      if (
        step === 1 &&
        (!registrationCountry.trim() || !registrationNumber.trim())
      )
        return L(
          "Registration jurisdiction and local legal entity identifier are required.",
          "La juridiction d’immatriculation et l’identifiant légal local sont requis.",
          "Se requieren la jurisdicción de registro y el identificador legal local.",
        );
      if (
        step === 2 &&
        (!contact.trim() ||
          !address.trim() ||
          !/^\+[1-9]\d{0,2}$/.test(phoneCode) ||
          phone.replace(/\D/g, "").length < 7)
      )
        return L(
          "Contact and registered address are required.",
          "Le contact et l’adresse enregistrée sont requis.",
          "Se requieren el contacto y la dirección registrada.",
        );
    }
    return null;
  }
  async function next() {
    const issue = validate();
    setFormError("");
    if (issue) return setFormError(issue);
    if (step < total - 1) return setStep((v) => v + 1);
    await finish();
  }
  async function finish() {
    if (!supabase)
      return setFormError(
        L(
          "Service unavailable",
          "Service indisponible",
          "Servicio no disponible",
        ),
      );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return setFormError(
        L("Session expired", "Session expirée", "Sesión caducada"),
      );
    setSaving(true);
    let error: any = null;
    const names = name.trim().split(/\s+/),
      first = names[0] || null,
      last = names.slice(1).join(" ") || null;
    const headline = professional
      ? `${type === "doctor" ? "Doctor" : "Nurse"} · ${Number(years) || 0} years experience`
      : `${companyType === "transport" ? "Medical transport" : "Event medical staffing"} organization`;
    const fullPhone = phoneCode + phone.replace(/\D/g, "").replace(/^0/, "");
    const p = await supabase
      .from("profiles")
      .update({
        first_name: first,
        last_name: professional ? last : null,
        avatar_url: photo,
        bio: bio.trim(),
        city: professional ? city : null,
        country: professional ? country : registrationCountry,
        headline,
        phone: fullPhone,
      })
      .eq("id", user.id);
    if (p.error) error = p.error;
    if (!error && professional) {
      const r = await supabase.from("professionals").upsert(
        {
          id: user.id,
          professional_type: type,
          specialty: specialty.trim(),
          spoken_languages: spokenLanguages,
          years_experience: Number(years) || 0,
          license_number: license.trim(),
          license_country: licenseCountry.trim(),
          license_authority: licenseAuthority.trim(),
          nationality: nationality.trim(),
          country_of_operation: country.trim(),
          base_city: city.trim(),
          base_airport_code: airport.trim().toUpperCase(),
          verification_status: "pending",
          available_now: false,
        },
        { onConflict: "id" },
      );
      error = r.error;
    }
    if (!error && !professional) {
      const r = await supabase.from("companies").upsert(
        {
          id: user.id,
          company_name: name.trim(),
          company_type: companyType,
          company_scope: companyType,
          organization_type: companyType,
          registration_country: registrationCountry.trim(),
          registration_number: registrationNumber.trim(),
          contact_name: contact.trim(),
          address: address.trim(),
          website: website.trim() || null,
          verification_status: "pending",
        },
        { onConflict: "id" },
      );
      error = r.error;
    }
    if (
      !error &&
      user.email?.trim().toLowerCase() === "brodycheneldiogo@gmail.com"
    ) {
      const test = await supabase.rpc("switch_designated_test_role", {
        p_role: professional ? "professional" : "company",
      });
      error = test.error;
      if (!error) {
        setSaving(false);
        return router.replace(professional ? "/home" : "/company");
      }
    }
    setSaving(false);
    if (error)
      return setFormError(
        `${L(
          "Could not save setup",
          "Impossible d’enregistrer",
          "No se pudo guardar",
        )}: ${error.message}`,
      );
    router.replace(
      professional
        ? "/professional/passport?required=1"
        : "/company-verification",
    );
  }
  const accent = professional ? colors.pro : colors.company,
    palette = professional ? gradients.professional : gradients.company;
  const steps = professional
    ? [
        L("Your profile", "Votre profil", "Tu perfil"),
        L("Experience", "Expérience", "Experiencia"),
        L("Operating base", "Base opérationnelle", "Base operativa"),
      ]
    : [
        L("Organization", "Organisation", "Organización"),
        L(
          "Official registration",
          "Immatriculation officielle",
          "Registro oficial",
        ),
        L("Contact details", "Coordonnées", "Datos de contacto"),
        L("Review", "Vérification", "Revisión"),
      ];
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[s.eyebrow, { color: accent }]}>
          {professional
            ? prefs.tr("professional").toUpperCase()
            : prefs.tr("organization").toUpperCase()}{" "}
          · {step + 1}/{total}
        </Text>
        <Text style={s.title}>{steps[step]}</Text>
        <Text style={s.sub}>
          {professional
            ? L(
                "Your public profile helps organizations understand who you are. Official registration details are reviewed separately.",
                "Votre profil public aide les entreprises à comprendre qui vous êtes. Les références officielles sont vérifiées séparément.",
                "Tu perfil público ayuda a las empresas a conocerte. Las referencias oficiales se revisan por separado.",
              )
            : L(
                "Build a clear organization profile. Official registration references are reviewed before access is approved.",
                "Créez un profil entreprise clair. Les références officielles sont vérifiées avant validation.",
                "Crea un perfil claro. Las referencias oficiales se revisan antes de aprobar el acceso.",
              )}
        </Text>
        <View style={s.card}>
          {professional && step === 0 && (
            <>
              <Field
                label={L("Specialty", "Spécialité", "Especialidad")}
                value={specialty}
                set={setSpecialty}
                placeholder={L(
                  "Emergency medicine, anesthesia, intensive care…",
                  "Médecine d’urgence, anesthésie, soins intensifs…",
                  "Urgencias, anestesia, cuidados intensivos…",
                )}
              />
              <Field
                label={L(
                  "Full legal name",
                  "Nom légal complet",
                  "Nombre legal completo",
                )}
                value={name}
                set={setName}
                placeholder={L(
                  "First and last name",
                  "Prénom et nom",
                  "Nombre y apellidos",
                )}
              />
              <Multiline
                label={L("Bio", "Bio", "Bio")}
                value={bio}
                set={setBio}
                placeholder={L(
                  "Briefly introduce your professional background and the kind of missions you are looking for.",
                  "Présentez brièvement votre parcours et les missions que vous recherchez.",
                  "Presenta brevemente tu trayectoria y las misiones que buscas.",
                )}
              />
              <ImagePicker
                value={photo}
                onPress={photoPick}
                label={L("Profile photo", "Photo de profil", "Foto de perfil")}
              />
            </>
          )}
          {professional && step === 1 && (
            <>
              <Text style={s.label}>
                {L("Profession", "Profession", "Profesión")}
              </Text>
              <View style={s.row}>
                <Choice
                  active={type === "doctor"}
                  label={prefs.tr("doctor")}
                  onPress={() => setType("doctor")}
                  accent={accent}
                />
                <Choice
                  active={type === "nurse"}
                  label={prefs.tr("nurse")}
                  onPress={() => setType("nurse")}
                  accent={accent}
                />
              </View>
              <Field
                label={L(
                  "Years of experience",
                  "Années d’expérience",
                  "Años de experiencia",
                )}
                value={years}
                set={setYears}
                placeholder="6"
                keyboard="number-pad"
              />
              <LanguagesField
                value={spokenLanguages}
                set={setSpokenLanguages}
                label={L(
                  "Spoken languages",
                  "Langues parlées",
                  "Idiomas hablados",
                )}
                placeholder={L(
                  "Type any language, then add it",
                  "Écrivez n’importe quelle langue, puis ajoutez-la",
                  "Escribe cualquier idioma y añádelo",
                )}
                addLabel={L("Add", "Ajouter", "Añadir")}
              />
            </>
          )}
          {professional && step === 2 && (
            <>
              <Field
                label={L("Base city", "Ville de base", "Ciudad base")}
                value={city}
                set={setCity}
                placeholder="Paris"
              />
              <Field
                label={L("Base country", "Pays de base", "País base")}
                value={country}
                set={setCountry}
                placeholder="France"
              />
              <Field
                label={L(
                  "Base airport (IATA)",
                  "Aéroport de base (IATA)",
                  "Aeropuerto base (IATA)",
                )}
                value={airport}
                set={setAirport}
                placeholder="CDG"
                autoCapitalize="characters"
              />
              <PhoneField
                code={phoneCode}
                setCode={setPhoneCode}
                value={phone}
                set={setPhone}
              />
            </>
          )}
          {!professional && step === 0 && (
            <>
              <Field
                label={L(
                  "Legal organization name",
                  "Nom légal de l’organisation",
                  "Nombre legal de la organización",
                )}
                value={name}
                set={setName}
                placeholder={prefs.tr("organization")}
              />
              <Multiline
                label={L("Bio", "Bio", "Bio")}
                value={bio}
                set={setBio}
                placeholder={L(
                  "Describe your organization, activity and the type of medical professionals you work with.",
                  "Décrivez votre organisation, votre activité et les professionnels médicaux avec lesquels vous travaillez.",
                  "Describe tu organización, actividad y los profesionales médicos con los que trabajas.",
                )}
              />
              <ImagePicker
                value={photo}
                onPress={photoPick}
                label={L(
                  "Company logo",
                  "Logo de l’entreprise",
                  "Logo de la empresa",
                )}
              />
              <Text style={s.label}>
                {L(
                  "Organization type",
                  "Type d’organisation",
                  "Tipo de organización",
                )}
              </Text>
              <Choice
                active={companyType === "transport"}
                label={L(
                  "Medical transport",
                  "Transport médical",
                  "Transporte médico",
                )}
                onPress={() => setCompanyType("transport")}
                accent={accent}
              />
              <View style={{ height: 9 }} />
              <Choice
                active={companyType === "event"}
                label={L(
                  "Event medical staffing",
                  "Médical événementiel",
                  "Personal médico para eventos",
                )}
                onPress={() => setCompanyType("event")}
                accent={accent}
              />
            </>
          )}
          {!professional && step === 1 && (
            <>
              <Field
                label={L(
                  "Country / jurisdiction of registration",
                  "Pays / juridiction d’immatriculation",
                  "País / jurisdicción de registro",
                )}
                value={registrationCountry}
                set={setRegistrationCountry}
                placeholder={L("Country", "Pays", "País")}
              />
              <Field
                label={L(
                  "Local legal entity identifier",
                  "Identifiant légal local de l’entreprise",
                  "Identificador legal local de la empresa",
                )}
                value={registrationNumber}
                set={setRegistrationNumber}
                placeholder={L(
                  "Number issued by the official local registry",
                  "Numéro délivré par le registre officiel local",
                  "Número del registro oficial local",
                )}
              />
              <Note
                text={L(
                  "There is no single company number used by every country. MediCrew checks this identifier together with its country and the uploaded evidence.",
                  "Il n’existe pas de numéro d’entreprise unique pour tous les pays. MediCrew vérifie cet identifiant avec son pays et le justificatif envoyé.",
                  "No existe un número empresarial único para todos los países. MediCrew verifica el identificador con su país y el documento enviado.",
                )}
              />
            </>
          )}
          {!professional && step === 2 && (
            <>
              <Field
                label={L(
                  "MediCrew representative for your organization — first and last name",
                  "Prénom et nom du représentant MediCrew de votre entreprise",
                  "Nombre y apellidos del representante de MediCrew de tu empresa",
                )}
                value={contact}
                set={setContact}
                placeholder={L(
                  "First and last name",
                  "Prénom et nom",
                  "Nombre y apellidos",
                )}
              />
              <Field
                label={L(
                  "Registered address",
                  "Adresse enregistrée",
                  "Dirección registrada",
                )}
                value={address}
                set={setAddress}
                placeholder={L(
                  "Address, city, country",
                  "Adresse, ville, pays",
                  "Dirección, ciudad, país",
                )}
              />
              <PhoneField
                code={phoneCode}
                setCode={setPhoneCode}
                value={phone}
                set={setPhone}
              />
              <Field
                label={L(
                  "Website (optional)",
                  "Site web (optionnel)",
                  "Sitio web (opcional)",
                )}
                value={website}
                set={setWebsite}
                placeholder="https://…"
                autoCapitalize="none"
              />
            </>
          )}
          {!professional && step === 3 && (
            <Review
              rows={[
                [prefs.tr("organization"), name],
                [L("Type", "Type", "Tipo"), companyType],
                [
                  L("Registration", "Immatriculation", "Registro"),
                  `${registrationCountry} · ${registrationNumber}`,
                ],
                [L("Contact", "Contact", "Contacto"), contact],
              ]}
            />
          )}
        </View>
        {formError ? (
          <View style={s.formError}>
            <Text style={s.formErrorText}>{formError}</Text>
          </View>
        ) : null}
        <View style={s.actions}>
          {step > 0 && (
            <Pressable onPress={() => setStep((v) => v - 1)} style={s.back}>
              <Text style={s.backText}>← {prefs.tr("back")}</Text>
            </Pressable>
          )}
          <Pressable onPress={next} disabled={saving} style={{ flex: 1 }}>
            <LinearGradient colors={palette} style={s.button}>
              <Text style={s.buttonText}>
                {saving
                  ? L("Saving…", "Enregistrement…", "Guardando…")
                  : step === total - 1
                    ? L(
                        "Continue to verification",
                        "Continuer vers la vérification",
                        "Continuar a verificación",
                      )
                    : L("Continue", "Continuer", "Continuar")}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
function Field({
  label,
  value,
  set,
  placeholder,
  keyboard,
  autoCapitalize = "words",
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  placeholder: string;
  keyboard?: any;
  autoCapitalize?: any;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={set}
        placeholder={placeholder}
        placeholderTextColor="#98A39E"
        keyboardType={keyboard}
        autoCapitalize={autoCapitalize}
        style={s.input}
      />
    </View>
  );
}
function PhoneField({
  code,
  setCode,
  value,
  set,
}: {
  code: string;
  setCode: (v: string) => void;
  value: string;
  set: (v: string) => void;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>Phone number · no SMS verification</Text>
      <View style={s.row}>
        <TextInput
          value={code}
          onChangeText={(raw) => {
            const digits = raw.replace(/\D/g, "").slice(0, 3);
            setCode(digits ? `+${digits}` : "+");
          }}
          keyboardType="phone-pad"
          maxLength={4}
          placeholder="+33"
          placeholderTextColor="#98A39E"
          accessibilityLabel="International calling code"
          style={s.phoneCode}
        />
        <TextInput
          value={value}
          onChangeText={set}
          keyboardType="phone-pad"
          placeholder="6 12 34 56 78"
          placeholderTextColor="#98A39E"
          accessibilityLabel="Phone number"
          style={[s.input, s.phoneNumber]}
        />
      </View>
      <Text style={s.phoneHelp}>International code from +1 to +999</Text>
    </View>
  );
}
function Multiline({
  label,
  value,
  set,
  placeholder,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={set}
        placeholder={placeholder}
        placeholderTextColor="#98A39E"
        multiline
        maxLength={500}
        style={[s.input, s.multi]}
      />
      <Text style={s.counter}>{value.length}/500</Text>
    </View>
  );
}
function LanguagesField({
  value,
  set,
  label,
  placeholder,
  addLabel,
}: {
  value: string[];
  set: (v: string[]) => void;
  label: string;
  placeholder: string;
  addLabel: string;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const language = draft.trim();
    if (!language || value.some((item) => item.toLowerCase() === language.toLowerCase())) return;
    set([...value, language].slice(0, 20));
    setDraft("");
  }
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.languageEntry}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder={placeholder}
          placeholderTextColor="#98A39E"
          style={[s.input, s.languageInput]}
        />
        <Pressable onPress={add} style={s.languageAdd}>
          <Text style={s.languageAddText}>{addLabel}</Text>
        </Pressable>
      </View>
      {value.length ? (
        <View style={s.languageChips}>
          {value.map((language) => (
            <Pressable
              key={language.toLowerCase()}
              onPress={() => set(value.filter((item) => item !== language))}
              style={s.languageChip}
            >
              <Text style={s.languageChipText}>{language} ×</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
function Choice({
  active,
  label,
  onPress,
  accent,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  accent: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        s.choice,
        active && { borderColor: accent, backgroundColor: accent + "12" },
      ]}
    >
      <Text style={s.choiceTitle}>{label}</Text>
    </Pressable>
  );
}
function ImagePicker({
  value,
  onPress,
  label,
}: {
  value: string | null;
  onPress: () => void;
  label: string;
}) {
  const url = avatarUrl(value);
  return (
    <Pressable onPress={onPress} style={s.imagePick}>
      {url ? (
        <Image source={{ uri: url }} style={s.image} />
      ) : (
        <View style={s.imageEmpty}>
          <Text style={s.imagePlus}>＋</Text>
        </View>
      )}
      <View>
        <Text style={s.choiceTitle}>{label}</Text>
        <Text style={s.choiceSub}>JPG, PNG or WEBP</Text>
      </View>
    </Pressable>
  );
}
function Note({ text }: { text: string }) {
  return (
    <View style={s.note}>
      <Text style={s.noteText}>{text}</Text>
    </View>
  );
}
function Review({ rows }: { rows: string[][] }) {
  return (
    <View>
      {rows.map(([a, b]) => (
        <View key={a} style={s.review}>
          <Text style={s.reviewLabel}>{a}</Text>
          <Text style={s.reviewValue}>{b || "—"}</Text>
        </View>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  container: { padding: 22, paddingBottom: 180 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  title: { fontSize: 34, fontWeight: "900", color: colors.ink, marginTop: 7 },
  sub: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 8 },
  card: {
    marginTop: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    padding: 17,
  },
  field: { marginBottom: 14 },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.ink,
    marginBottom: 7,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: 13,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  multi: { height: 110, textAlignVertical: "top", paddingTop: 12 },
  counter: {
    fontSize: 9,
    color: colors.muted,
    textAlign: "right",
    marginTop: 4,
  },
  row: { flexDirection: "row", gap: 8 },
  phoneCode: {
    width: 82,
    height: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: "800",
    color: colors.ink,
    backgroundColor: colors.white,
  },
  phoneNumber: { flex: 1 },
  phoneHelp: { fontSize: 10, color: colors.muted, marginTop: 6 },
  languageEntry: { flexDirection: "row", gap: 8, alignItems: "stretch" },
  languageInput: { flex: 1 },
  languageAdd: {
    minWidth: 76,
    borderRadius: radii.md,
    backgroundColor: colors.proDark,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  languageAddText: { color: colors.white, fontSize: 11, fontWeight: "900" },
  languageChips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 9 },
  languageChip: {
    borderRadius: 999,
    backgroundColor: colors.proSoft,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  languageChipText: { color: colors.proDark, fontSize: 11, fontWeight: "800" },
  formError: {
    marginTop: 14,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: "#FDECEC",
    borderWidth: 1,
    borderColor: "#F0CACA",
  },
  formErrorText: { fontSize: 12, color: "#A33A3A", fontWeight: "700" },
  choice: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    padding: 11,
  },
  choiceTitle: { fontSize: 12.5, fontWeight: "900", color: colors.ink },
  choiceSub: { fontSize: 10, color: colors.muted, marginTop: 3 },
  imagePick: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    padding: 12,
    marginBottom: 14,
  },
  image: { width: 52, height: 52, borderRadius: 16 },
  imageEmpty: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  imagePlus: { fontSize: 25, color: colors.muted },
  note: {
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.proSoft,
    marginTop: 5,
  },
  noteText: { fontSize: 11, lineHeight: 17, color: colors.ink },
  actions: { flexDirection: "row", gap: 9, marginTop: 16 },
  back: {
    height: 54,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { fontSize: 12, fontWeight: "800", color: colors.ink },
  button: {
    height: 54,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 13, fontWeight: "900", color: colors.white },
  review: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  reviewLabel: { fontSize: 10, color: colors.muted },
  reviewValue: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
    marginTop: 3,
  },
});
