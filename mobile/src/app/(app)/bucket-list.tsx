import { useCallback, useEffect, useState } from "react";
import { RefreshControl, View } from "react-native";
import {
  createBucketItem,
  listBucketItems,
  updateBucketItem,
  type BucketItem,
  type BucketStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { Body, Button, Card, Chip, ErrorText, Field, H2, Muted, Row, Screen } from "@/theme/ui";
import { colors } from "@/theme/tokens";

const NEXT_STATUS: Record<BucketStatus, BucketStatus> = {
  planned: "in_progress",
  in_progress: "done",
  done: "planned",
};

const STATUS_LABEL: Record<BucketStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  done: "Done ✓",
};

export default function BucketListScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<BucketItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await listBucketItems(token));
      setError(null);
    } catch {
      setError("Couldn't load your bucket list.");
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
      await createBucketItem(token, { title: title.trim(), category: category.trim() || null });
      setTitle("");
      setCategory("");
      await load();
    } catch {
      setError("Couldn't add that item.");
    } finally {
      setBusy(false);
    }
  }

  async function cycle(item: BucketItem) {
    if (!token) return;
    const status = NEXT_STATUS[item.status];
    try {
      const updated = await updateBucketItem(token, item.id, { status });
      setItems((cur) => cur.map((i) => (i.id === item.id ? updated : i)));
    } catch {
      setError("Couldn't update that item.");
    }
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.dawn} />
      }
    >
      <Card>
        <H2>Add to the list</H2>
        <Field label="What do you want to do?" value={title} onChangeText={setTitle} placeholder="e.g. Road trip up the coast" />
        <Field label="Category (optional)" value={category} onChangeText={setCategory} placeholder="travel, food, someday…" />
        <Button title="Add item" onPress={add} loading={busy} disabled={busy || !title.trim()} />
        <ErrorText>{error}</ErrorText>
      </Card>

      {items.length === 0 ? (
        <EmptyState icon="✨" title="Your list is empty">
          Add dreams big and small you want to share together.
        </EmptyState>
      ) : (
        <View style={{ gap: 0 }}>
          {items.map((item) => (
            <Card key={item.id}>
              <H2 style={item.status === "done" ? { textDecorationLine: "line-through", color: colors.muted } : undefined}>
                {item.title}
              </H2>
              {item.category ? <Muted>{item.category}</Muted> : null}
              <Row>
                <Chip label={STATUS_LABEL[item.status]} selected={item.status === "done"} onPress={() => cycle(item)} />
              </Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
