import { useCallback, useEffect, useState } from "react";
import { RefreshControl, View } from "react-native";
import { createVisit, listVisits, updateVisit, type Visit } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { shortDate } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Body, Button, Card, Chip, ErrorText, Field, H2, Muted, Row, Screen } from "@/theme/ui";
import { colors } from "@/theme/tokens";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function VisitsScreen() {
  const { token } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setVisits(await listVisits(token));
      setError(null);
    } catch {
      setError("Couldn't load visits.");
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
    if (!token || !location.trim() || !DATE_RE.test(startDate)) {
      setError("Add a location and a start date as YYYY-MM-DD.");
      return;
    }
    setBusy(true);
    try {
      await createVisit(token, {
        location: location.trim(),
        start_date: startDate,
        end_date: DATE_RE.test(endDate) ? endDate : null,
        notes: notes.trim() || null,
      });
      setLocation("");
      setStartDate("");
      setEndDate("");
      setNotes("");
      await load();
    } catch {
      setError("Couldn't create that visit.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(visit: Visit, status: Visit["status"]) {
    if (!token) return;
    try {
      const updated = await updateVisit(token, visit.id, { status });
      setVisits((cur) => cur.map((v) => (v.id === visit.id ? updated : v)));
    } catch {
      setError("Couldn't update that visit.");
    }
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.dawn} />
      }
    >
      <Card>
        <H2>Plan a visit</H2>
        <Field label="Location" value={location} onChangeText={setLocation} placeholder="e.g. Chicago" />
        <Field label="Start date" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        <Field label="End date (optional)" value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
        <Field label="Notes (optional)" value={notes} onChangeText={setNotes} multiline placeholder="Flights, plans…" />
        <Button title="Add visit" onPress={add} loading={busy} disabled={busy} />
        <ErrorText>{error}</ErrorText>
      </Card>

      {visits.length === 0 ? (
        <EmptyState icon="✈️" title="No visits planned">
          Add your next time together to start the countdown.
        </EmptyState>
      ) : (
        <View style={{ gap: 0 }}>
          {visits.map((v) => (
            <Card key={v.id}>
              <H2>📍 {v.location}</H2>
              <Muted>
                {shortDate(v.start_date)}
                {v.end_date ? ` → ${shortDate(v.end_date)}` : ""} · {v.status}
                {v.days_until !== null && v.status === "planned"
                  ? ` · ${v.days_until === 0 ? "today" : `${v.days_until}d`}`
                  : ""}
              </Muted>
              {v.notes ? <Body>{v.notes}</Body> : null}
              <Row>
                {v.status !== "completed" && (
                  <Chip label="Mark completed" onPress={() => setStatus(v, "completed")} />
                )}
                {v.status !== "cancelled" && (
                  <Chip label="Cancel" onPress={() => setStatus(v, "cancelled")} />
                )}
                {v.status !== "planned" && (
                  <Chip label="Reopen" onPress={() => setStatus(v, "planned")} />
                )}
              </Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
