import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radius, space } from "@/theme/tokens";

/** Dashed, centered placeholder for empty lists (mirrors the web .empty-state). */
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {typeof children === "string" ? <Text style={styles.body}>{children}</Text> : children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: space(4),
    paddingHorizontal: space(2),
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderStyle: "dashed",
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    gap: 6,
  },
  icon: { fontSize: 40 },
  title: { fontSize: 18, fontWeight: "600", color: colors.text },
  body: { color: colors.muted, textAlign: "center", maxWidth: 320 },
});
