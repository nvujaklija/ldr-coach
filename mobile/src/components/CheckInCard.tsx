import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { getCheckIns, submitTodayCheckIn, type CheckInList } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Body, Button, Card, Chip, Field, H2, Muted, Row } from "@/theme/ui";
import { colors } from "@/theme/tokens";

type Status = "loading" | "ready" | "saving" | "saved" | "error";

const MOOD_SCALE = [
  { value: 1, emoji: "😞", label: "Very low" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

const CONNECTION_SCALE = [
  { value: 1, emoji: "💔", label: "Distant" },
  { value: 2, emoji: "🙁", label: "Strained" },
  { value: 3, emoji: "😐", label: "Neutral" },
  { value: 4, emoji: "💞", label: "Close" },
  { value: 5, emoji: "❤️", label: "Connected" },
];

const TAG_PRESETS = ["tired", "stressed", "happy", "missing-you", "grateful"];

function Scale({
  legend,
  scale,
  value,
  onChange,
}: {
  legend: string;
  scale: { value: number; emoji: string; label: string }[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.scale}>
      <Body style={styles.legend}>{legend}</Body>
      <Row>
        {scale.map((step) => (
          <Chip
            key={step.value}
            label={step.emoji}
            selected={value === step.value}
            onPress={() => onChange(step.value)}
          />
        ))}
      </Row>
    </View>
  );
}

export function CheckInCard() {
  const { token } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [recent, setRecent] = useState<CheckInList | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [connection, setConnection] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");

  async function loadRecent(value: string) {
    try {
      setRecent(await getCheckIns(value, 7));
      setStatus((s) => (s === "loading" ? "ready" : s));
    } catch {
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!token) return;
    let active = true;
    getCheckIns(token, 7)
      .then((list) => {
        if (!active) return;
        setRecent(list);
        setStatus("ready");
      })
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, [token]);

  function toggleTag(tag: string) {
    setTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));
  }

  async function handleSubmit() {
    if (!token || mood === null || connection === null) return;
    setStatus("saving");
    try {
      await submitTodayCheckIn(token, {
        mood_score: mood,
        connection_score: connection,
        tags,
        note: note.trim() || null,
      });
      setStatus("saved");
      await loadRecent(token);
    } catch {
      setStatus("error");
    }
  }

  const averages = recent?.averages;
  const canSubmit = mood !== null && connection !== null && status !== "saving";

  return (
    <Card>
      <H2>Today&apos;s check-in</H2>

      <Scale legend="Mood" scale={MOOD_SCALE} value={mood} onChange={setMood} />
      <Scale legend="Connection" scale={CONNECTION_SCALE} value={connection} onChange={setConnection} />

      <View style={styles.scale}>
        <Body style={styles.legend}>Tags</Body>
        <Row>
          {TAG_PRESETS.map((tag) => (
            <Chip key={tag} label={tag} selected={tags.includes(tag)} onPress={() => toggleTag(tag)} />
          ))}
        </Row>
      </View>

      <Field
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={2000}
        placeholder="Anything you want to share?"
      />

      <Button
        title={status === "saving" ? "Saving…" : "Save check-in"}
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={status === "saving"}
      />

      {status === "saved" && <Muted style={{ color: colors.dawnDeep }}>Check-in saved.</Muted>}
      {status === "error" && <Muted style={{ color: colors.danger }}>Something went wrong — please try again.</Muted>}

      {averages && averages.count > 0 ? (
        <Muted>
          Last 7 days · mood {averages.mood_score?.toFixed(1)} · connection{" "}
          {averages.connection_score?.toFixed(1)} ({averages.count} check-in
          {averages.count === 1 ? "" : "s"})
        </Muted>
      ) : (
        <Muted>No check-ins yet this week — yours will start the trend.</Muted>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  scale: { gap: 8 },
  legend: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.muted,
    fontWeight: "600",
  },
});
