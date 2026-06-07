import { useCallback, useEffect, useState } from "react";
import { RefreshControl, View } from "react-native";
import { createMemory, listMemories, type MemoryItem } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Body, Button, Card, ErrorText, Field, H2, Muted, Screen } from "@/theme/ui";
import { colors } from "@/theme/tokens";

const TYPE_ICON: Record<string, string> = {
  photo: "📷",
  note: "📝",
  ritual: "🕯️",
  visit: "✈️",
};

function memoryText(m: MemoryItem): string | null {
  const data = m.data as Record<string, unknown>;
  const text = data.text ?? data.body ?? data.note;
  return typeof text === "string" ? text : null;
}

export default function MemoriesScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await listMemories(token, 30, 0));
      setError(null);
    } catch {
      setError("Couldn't load memories.");
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
    if (!token || !text.trim()) return;
    setBusy(true);
    try {
      await createMemory(token, "note", { title: title.trim() || undefined, text: text.trim() });
      setTitle("");
      setText("");
      await load();
    } catch {
      setError("Couldn't save that memory.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.dawn} />
      }
    >
      <Card>
        <H2>Add a memory</H2>
        <Field label="Title (optional)" value={title} onChangeText={setTitle} placeholder="That sunset call" />
        <Field
          label="Note"
          value={text}
          onChangeText={setText}
          multiline
          placeholder="What do you want to remember?"
        />
        <Button title="Save memory" onPress={add} loading={busy} disabled={busy || !text.trim()} />
        <ErrorText>{error}</ErrorText>
      </Card>

      {items.length === 0 ? (
        <EmptyState icon="📸" title="No memories yet">
          Moments from rituals, visits, and notes will gather here over time.
        </EmptyState>
      ) : (
        <View style={{ gap: 0 }}>
          {items.map((m) => {
            const body = memoryText(m);
            return (
              <Card key={m.id}>
                <Muted>
                  {TYPE_ICON[m.type] ?? "•"} {m.type} · {relativeTime(m.created_at)}
                </Muted>
                {m.data.title ? <H2>{String(m.data.title)}</H2> : null}
                {body ? <Body>{body}</Body> : null}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
