import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/theme/tokens";

/** Emoji tab icon — keeps the playful "Two Skies" tone without an icon font. */
function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text, fontWeight: "600" },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: colors.cardSolid,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.accentStrong,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon glyph="🏡" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="rituals"
        options={{
          title: "Rituals",
          tabBarIcon: ({ focused }) => <TabIcon glyph="🕯️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="bereal"
        options={{
          title: "BeReal",
          tabBarIcon: ({ focused }) => <TabIcon glyph="🤳" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="letters"
        options={{
          title: "Letters",
          tabBarIcon: ({ focused }) => <TabIcon glyph="✉️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ focused }) => <TabIcon glyph="✨" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
