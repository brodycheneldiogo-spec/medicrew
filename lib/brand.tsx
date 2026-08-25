import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients, radii } from "./theme";

export function MediCrewLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.row, compact && styles.compactRow]}>
      <Image
        source={require("../assets/icon.png")}
        accessibilityLabel="MediCrew"
        style={[styles.mark, compact && styles.compactMark]}
      />
      {!compact && (
        <View style={styles.wordmarkWrap}>
          <Text style={styles.wordmark}>
            Medi<Text style={styles.wordmarkCrew}>Crew</Text>
          </Text>
          <Text style={styles.tagline}>CARE MOVES FORWARD</Text>
        </View>
      )}
    </View>
  );
}

export function GradientButton({
  label,
  onPress,
  disabled = false,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "professional" | "company";
}) {
  const palette =
    variant === "professional"
      ? gradients.professional
      : variant === "company"
        ? gradients.company
        : gradients.primary;
  return (
    <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button">
      <LinearGradient
        colors={palette}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.button, disabled && styles.disabled]}
      >
        <Text style={styles.buttonText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 9 },
  compactRow: { gap: 0 },
  mark: { width: 62, height: 62, borderRadius: 17 },
  compactMark: { width: 52, height: 52, borderRadius: 15 },
  wordmarkWrap: { justifyContent: "center" },
  wordmark: {
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -1.1,
    color: colors.ink,
  },
  wordmarkCrew: { color: colors.greenDark },
  tagline: {
    fontSize: 6.5,
    fontWeight: "800",
    letterSpacing: 2.2,
    color: colors.muted,
    marginTop: 1,
  },
  button: {
    height: 56,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: colors.greenDark,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  disabled: { opacity: 0.45 },
});
