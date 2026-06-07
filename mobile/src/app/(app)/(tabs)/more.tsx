import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { Card, H1, Muted, Screen } from "@/theme/ui";
import { colors, radius } from "@/theme/tokens";

const LINKS = [
  { href: "/memories", icon: "📸", label: "Memories", hint: "Your shared timeline" },
  { href: "/bucket-list", icon: "✨", label: "Bucket List", hint: "Dreams and plans together" },
  { href: "/visits", icon: "✈️", label: "Visits", hint: "Plan your next time together" },
  { href: "/notifications", icon: "🔔", label: "Notifications", hint: "Reminders and updates" },
  { href: "/settings", icon: "⚙️", label: "Settings", hint: "Theme, timezone, account" },
] as const;

export default function MoreScreen() {
  const router = useRouter();
  const { me } = useAuth();

  return (
    <Screen>
      <H1 highlight="more">Explore</H1>
      {me && (
        <Card>
          <Text style={styles.name}>{me.display_name}</Text>
          <Muted>{me.email}</Muted>
          {me.couple ? <Muted>💞 {me.couple.name}</Muted> : <Muted>Not paired yet</Muted>}
        </Card>
      )}

      <View style={styles.list}>
        {LINKS.map((link) => (
          <Pressable
            key={link.href}
            onPress={() => router.push(link.href)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.icon}>{link.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{link.label}</Text>
              <Muted>{link.hint}</Muted>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 20, fontWeight: "600", color: colors.text },
  list: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
  },
  pressed: { opacity: 0.8 },
  icon: { fontSize: 24 },
  label: { fontSize: 16, fontWeight: "600", color: colors.text },
  chevron: { fontSize: 26, color: colors.muted },
});
