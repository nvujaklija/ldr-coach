import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  ScrollView,
  StyleSheet,
  Text,
  type TextProps,
  TextInput,
  type TextInputProps,
  View,
  type ViewProps,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, horizon, radius, space } from "./tokens";

/** Full-screen night canvas with a scrolling, padded content column. */
export function Screen({
  children,
  scroll = true,
  refreshControl,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<any>;
}) {
  const inner = (
    <View style={styles.column}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

/** Display heading. `highlight` renders in warm accent (the web's gradient <em>). */
export function H1({
  children,
  highlight,
  style,
}: {
  children: ReactNode;
  highlight?: string;
  style?: TextProps["style"];
}) {
  return (
    <Text style={[styles.h1, style]}>
      {children}
      {highlight ? <Text style={styles.h1em}> {highlight}</Text> : null}
    </Text>
  );
}

export function H2({ children, style }: { children: ReactNode; style?: TextProps["style"] }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}

export function Body({ children, style, ...rest }: TextProps & { children: ReactNode }) {
  return (
    <Text style={[styles.body, style]} {...rest}>
      {children}
    </Text>
  );
}

export function Muted({ children, style, ...rest }: TextProps & { children: ReactNode }) {
  return (
    <Text style={[styles.muted, style]} {...rest}>
      {children}
    </Text>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {children}
    </Text>
  );
}

/** Glassy card with the signature horizon strip along its top edge. */
export function Card({ children, style }: { children: ReactNode; style?: ViewProps["style"] }) {
  return (
    <View style={[styles.card, style]}>
      <LinearGradient
        colors={[...horizon.colors]}
        locations={[...horizon.locations]}
        start={horizon.start}
        end={horizon.end}
        style={styles.cardStrip}
      />
      {children}
    </View>
  );
}

/** Primary action: horizon-gradient pill with dark ink label. */
export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = "primary",
  style,
}: {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  style?: ViewProps["style"];
}) {
  const isDisabled = disabled || loading;
  if (variant === "ghost") {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.ghostBtn,
          isDisabled && styles.btnDisabled,
          pressed && styles.pressed,
          style,
        ]}
      >
        <Text style={styles.ghostBtnText}>{title}</Text>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      style={({ pressed }) => [pressed && styles.pressed, isDisabled && styles.btnDisabled, style]}
    >
      <LinearGradient
        colors={[...horizon.colors]}
        locations={[...horizon.locations]}
        start={horizon.start}
        end={horizon.end}
        style={styles.primaryBtn}
      >
        {loading ? (
          <ActivityIndicator color={colors.onAccent} />
        ) : (
          <Text style={styles.primaryBtnText}>{title}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

/** Subtle text-only button (the web's `button.link`). */
export function LinkButton({ title, onPress }: { title: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
      <Text style={styles.linkBtn}>{title}</Text>
    </Pressable>
  );
}

/** Pill toggle. Selected state fills with the horizon gradient. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  if (selected) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}>
        <LinearGradient
          colors={[...horizon.colors]}
          locations={[...horizon.locations]}
          start={horizon.start}
          end={horizon.end}
          style={[styles.chip, styles.chipSelected]}
        >
          <Text style={styles.chipSelectedText}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: false }}
      style={({ pressed }) => [styles.chip, styles.chipIdle, pressed && styles.pressed]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

/** Labelled text input matching the web form fields. */
export function Field({
  label,
  ...input
}: { label: string } & TextInputProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, input.multiline && styles.inputMultiline]}
        {...input}
      />
    </View>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: ViewProps["style"] }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: space(6) },
  column: { paddingHorizontal: space(2.5), paddingTop: space(2), gap: space(2) },

  h1: { fontSize: 30, fontWeight: "600", color: colors.text, letterSpacing: -0.5, lineHeight: 34 },
  h1em: { color: colors.accentStrong, fontStyle: "italic", fontWeight: "600" },
  h2: { fontSize: 21, fontWeight: "600", color: colors.text, marginBottom: 2 },
  body: { fontSize: 16, color: colors.text, lineHeight: 24 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  error: { color: colors.danger, fontSize: 14, marginVertical: 6 },

  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space(2),
    gap: space(1.5),
    overflow: "hidden",
  },
  cardStrip: { position: "absolute", top: 0, left: 0, right: 0, height: 2, opacity: 0.6 },

  primaryBtn: {
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: colors.onAccent, fontSize: 16, fontWeight: "700", letterSpacing: 0.2 },
  ghostBtn: {
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: "transparent",
  },
  ghostBtnText: { color: colors.textDim, fontSize: 16, fontWeight: "600" },
  linkBtn: { color: colors.dawn, fontSize: 15, fontWeight: "600" },
  btnDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.85, transform: [{ translateY: 1 }] },

  chip: { borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: 15 },
  chipIdle: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: "rgba(11,12,26,0.4)" },
  chipSelected: { borderWidth: 0 },
  chipText: { color: colors.textDim, fontSize: 15, fontWeight: "500" },
  chipSelectedText: { color: colors.onAccent, fontSize: 15, fontWeight: "700" },

  field: { gap: 6 },
  fieldLabel: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "rgba(11,12,26,0.6)",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: "top" },

  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
});
