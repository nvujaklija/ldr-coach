import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, View } from "react-native";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { relativeTime } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Body, Button, H2, Muted, Screen } from "@/theme/ui";
import { colors, radius } from "@/theme/tokens";

export default function NotificationsScreen() {
  const { token } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const list = await listNotifications(token, true);
      setItems(list.notifications);
      setUnread(list.unread_count);
    } catch {
      /* shown via empty state */
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

  async function readOne(n: AppNotification) {
    if (!token || n.read_at) return;
    try {
      await markNotificationRead(token, n.id);
      setItems((cur) => cur.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      /* ignore */
    }
  }

  async function readAll() {
    if (!token) return;
    try {
      const list = await markAllNotificationsRead(token);
      setItems(list.notifications);
      setUnread(list.unread_count);
    } catch {
      /* ignore */
    }
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.dawn} />
      }
    >
      {unread > 0 && <Button title={`Mark all read (${unread})`} variant="ghost" onPress={readAll} />}

      {items.length === 0 ? (
        <EmptyState icon="🔔" title="No notifications">
          Reminders for visits, rituals, and check-ins will show up here.
        </EmptyState>
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((n) => {
            const isUnread = !n.read_at;
            return (
              <Pressable
                key={n.id}
                onPress={() => readOne(n)}
                style={[styles.row, isUnread && styles.unread]}
              >
                <H2 style={{ fontSize: 16 }}>{n.title}</H2>
                {n.body ? <Body style={{ color: colors.textDim }}>{n.body}</Body> : null}
                <Muted>{relativeTime(n.trigger_at ?? n.created_at)}</Muted>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
    gap: 4,
  },
  unread: {
    backgroundColor: colors.accentSoft,
    borderLeftWidth: 3,
    borderLeftColor: colors.dusk,
  },
});
