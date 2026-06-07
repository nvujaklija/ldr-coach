import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getNextVisit, type Visit } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { shortDate } from "@/lib/format";
import { Body, Button, Card, H2, Muted } from "@/theme/ui";
import { colors } from "@/theme/tokens";

/** The countdown beacon to the couple's next planned visit. */
export function NextVisitWidget() {
  const { token } = useAuth();
  const router = useRouter();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    getNextVisit(token)
      .then((v) => active && setVisit(v))
      .catch(() => {})
      .finally(() => active && setLoaded(true));
    return () => {
      active = false;
    };
  }, [token]);

  if (!loaded) return null;

  return (
    <Card>
      <H2>Next visit</H2>
      {visit ? (
        <View style={{ gap: 4 }}>
          {visit.days_until !== null && (
            <Text style={styles.countdown}>
              {visit.days_until === 0 ? "Today!" : visit.days_until}
            </Text>
          )}
          {visit.days_until !== null && visit.days_until > 0 && (
            <Muted>{visit.days_until === 1 ? "day to go" : "days to go"}</Muted>
          )}
          <Body>
            📍 {visit.location} · {shortDate(visit.start_date)}
          </Body>
          {visit.notes ? <Muted>{visit.notes}</Muted> : null}
        </View>
      ) : (
        <Muted>No visit on the calendar yet. Plan your next one together.</Muted>
      )}
      <Button title="Manage visits" variant="ghost" onPress={() => router.push("/visits")} />
    </Card>
  );
}

const styles = StyleSheet.create({
  countdown: {
    fontSize: 64,
    fontWeight: "300",
    color: colors.accentStrong,
    letterSpacing: -2,
    lineHeight: 66,
  },
});
