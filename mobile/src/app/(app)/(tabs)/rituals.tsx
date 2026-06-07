import { useCallback, useEffect, useState } from "react";
import { RefreshControl, View } from "react-native";
import {
  createRitual,
  listRitualTemplates,
  listRituals,
  updateRitual,
  updateRitualInstance,
  type Ritual,
  type RitualCadence,
  type RitualTemplate,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { deviceTimezone, shortDate, shortTime } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Body, Button, Card, Chip, ErrorText, Field, H1, H2, Muted, Row, Screen } from "@/theme/ui";
import { colors } from "@/theme/tokens";

const CADENCES: RitualCadence[] = ["daily", "weekly", "monthly"];

export default function RitualsScreen() {
  const { token } = useAuth();
  const [rituals, setRituals] = useState<Ritual[]>([]);
  const [templates, setTemplates] = useState<RitualTemplate[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<RitualCadence>("weekly");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [r, t] = await Promise.all([listRituals(token), listRitualTemplates(token)]);
      setRituals(r);
      setTemplates(t);
      setError(null);
    } catch {
      setError("Couldn't load rituals.");
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function add() {
    if (!token || !title.trim()) return;
    setBusy(true);
    try {
      await createRitual(token, { title: title.trim(), cadence, timezone: deviceTimezone() });
      setTitle("");
      await load();
    } catch {
      setError("Couldn't create that ritual.");
    } finally {
      setBusy(false);
    }
  }

  function useTemplate(t: RitualTemplate) {
    setTitle(t.title);
    if (CADENCES.includes(t.default_cadence as RitualCadence)) {
      setCadence(t.default_cadence as RitualCadence);
    }
  }

  async function markDone(r: Ritual) {
    if (!token || !r.next_instance) return;
    try {
      const updated = await updateRitualInstance(token, r.id, r.next_instance.id, "done");
      setRituals((cur) => cur.map((x) => (x.id === r.id ? updated : x)));
    } catch {
      setError("Couldn't update that ritual.");
    }
  }

  async function togglePause(r: Ritual) {
    if (!token) return;
    try {
      const updated = await updateRitual(token, r.id, {
        status: r.status === "active" ? "paused" : "active",
      });
      setRituals((cur) => cur.map((x) => (x.id === r.id ? updated : x)));
    } catch {
      setError("Couldn't update that ritual.");
    }
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.dawn} />
      }
    >
      <H1 highlight="rituals">Shared</H1>
      <Muted>Little habits that keep you in sync, wherever you are.</Muted>

      <Card>
        <H2>New ritual</H2>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Sunday video call" />
        <Body style={{ fontSize: 12, color: colors.muted, letterSpacing: 1, textTransform: "uppercase", fontWeight: "600" }}>
          Cadence
        </Body>
        <Row>
          {CADENCES.map((c) => (
            <Chip key={c} label={c} selected={cadence === c} onPress={() => setCadence(c)} />
          ))}
        </Row>
        {templates.length > 0 && (
          <>
            <Muted>Or start from a template:</Muted>
            <Row>
              {templates.map((t) => (
                <Chip key={t.key} label={`${t.icon ?? ""} ${t.title}`.trim()} onPress={() => useTemplate(t)} />
              ))}
            </Row>
          </>
        )}
        <Button title="Add ritual" onPress={add} loading={busy} disabled={busy || !title.trim()} />
        <ErrorText>{error}</ErrorText>
      </Card>

      {rituals.length === 0 ? (
        <EmptyState icon="🕯️" title="No rituals yet">
          Add your first shared ritual above to start building rhythm.
        </EmptyState>
      ) : (
        rituals.map((r) => (
          <Card key={r.id}>
            <H2>{r.title}</H2>
            <Muted>
              {r.cadence}
              {r.status !== "active" ? ` · ${r.status}` : ""}
            </Muted>
            {r.description ? <Body>{r.description}</Body> : null}
            {r.next_instance ? (
              <Muted>
                Next: {shortDate(r.next_instance.scheduled_for)} {shortTime(r.next_instance.scheduled_for)}
              </Muted>
            ) : (
              <Muted>No upcoming instance scheduled.</Muted>
            )}
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {r.next_instance && r.next_instance.status !== "done" && (
                <Button title="Mark done" onPress={() => markDone(r)} style={{ flexGrow: 1 }} />
              )}
              <Button
                title={r.status === "active" ? "Pause" : "Resume"}
                variant="ghost"
                onPress={() => togglePause(r)}
                style={{ flexGrow: 1 }}
              />
            </View>
          </Card>
        ))
      )}
    </Screen>
  );
}
