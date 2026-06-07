import { useEffect, useState } from "react";
import { RefreshControl } from "react-native";
import { CheckInCard } from "@/components/CheckInCard";
import { CoupleOnboarding } from "@/components/CoupleOnboarding";
import { NextVisitWidget } from "@/components/NextVisitWidget";
import { getSettings, type Settings } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { H1, Muted, Screen } from "@/theme/ui";
import { colors } from "@/theme/tokens";

/** Whole days the couple has been together, or null if no start date set. */
function daysTogether(startDate: string | null): number | null {
  if (!startDate) return null;
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const ms = Date.now() - start.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default function HomeScreen() {
  const { token, me, refresh } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!token) return;
    try {
      setSettings(await getSettings(token));
    } catch {
      /* dashboard still works without settings */
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refresh().catch(() => {}), load()]);
    setRefreshing(false);
  }

  const showCheckins = settings?.couple?.show_checkins ?? true;
  const showVisits = settings?.couple?.show_visits ?? true;
  const together = daysTogether(settings?.couple?.relationship_start_date ?? null);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.dawn} />
      }
    >
      <H1 highlight={`${me?.display_name ?? ""} 👋`}>Hi</H1>
      <Muted>Your shared space for staying close across the distance.</Muted>
      {together !== null && (
        <Muted>💞 Together for {together.toLocaleString()} days</Muted>
      )}

      {!me?.couple && <CoupleOnboarding />}
      {showCheckins && <CheckInCard />}
      {me?.couple && showVisits && <NextVisitWidget />}
    </Screen>
  );
}
