import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
import { colors } from "@/theme/tokens";

/** Auth boundary for everything under /(app). Unauthenticated → /login. */
export default function AppLayout() {
  const { token, loading } = useAuth();

  // Once signed in, request notification permission so BeReal-moment and
  // reminder pushes can reach this device (see lib/notifications.ts).
  useEffect(() => {
    if (token) void registerForPushNotificationsAsync();
  }, [token]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.dawn} size="large" />
      </View>
    );
  }

  if (!token) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text, fontWeight: "600" },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="memories" options={{ title: "Memories" }} />
      <Stack.Screen name="bucket-list" options={{ title: "Bucket List" }} />
      <Stack.Screen name="visits" options={{ title: "Visits" }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
      <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
    </Stack>
  );
}
