import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";
import {
  getSettings,
  updateSettings,
  type Settings,
  type SettingsUpdate,
  type UserSettings,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { deviceTimezone } from "@/lib/format";
import { Body, Button, Card, ErrorText, Field, H2, Muted, Screen } from "@/theme/ui";
import { colors } from "@/theme/tokens";

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Body style={{ flex: 1 }}>{label}</Body>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.duskDeep, false: colors.borderStrong }}
        thumbColor={colors.text}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { token, logout } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [timezone, setTimezone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const s = await getSettings(token);
      setSettings(s);
      setTimezone(s.user.timezone);
    } catch {
      setError("Couldn't load settings.");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(patch: SettingsUpdate) {
    if (!token) return;
    setSaving(true);
    try {
      const updated = await updateSettings(token, patch);
      setSettings(updated);
      setError(null);
    } catch {
      setError("Couldn't save that change.");
    } finally {
      setSaving(false);
    }
  }

  function setUser<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    save({ user: { [key]: value } as Partial<UserSettings> });
  }

  const user = settings?.user;

  return (
    <Screen>
      <Card>
        <H2>Notifications</H2>
        <Muted>Choose the reminders you want to receive.</Muted>
        <ToggleRow
          label="Daily check-in reminders"
          value={user?.notify_checkin_reminders ?? false}
          onValueChange={(v) => setUser("notify_checkin_reminders", v)}
        />
        <ToggleRow
          label="Visit reminders"
          value={user?.notify_visit_reminders ?? false}
          onValueChange={(v) => setUser("notify_visit_reminders", v)}
        />
        <ToggleRow
          label="Ritual reminders"
          value={user?.notify_ritual_reminders ?? false}
          onValueChange={(v) => setUser("notify_ritual_reminders", v)}
        />
      </Card>

      <Card>
        <H2>Time zone</H2>
        <Muted>Used to schedule rituals and BeReal moments in your local time.</Muted>
        <Field label="IANA timezone" value={timezone} onChangeText={setTimezone} autoCapitalize="none" placeholder="America/New_York" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="Save timezone" onPress={() => setUser("timezone", timezone.trim())} loading={saving} style={{ flexGrow: 1 }} />
          <Button title="Use device" variant="ghost" onPress={() => setTimezone(deviceTimezone())} style={{ flexGrow: 1 }} />
        </View>
      </Card>

      <ErrorText>{error}</ErrorText>

      <Card>
        <H2>Account</H2>
        <Button
          title="Log out"
          variant="ghost"
          onPress={() => {
            logout();
            router.replace("/login");
          }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
});
