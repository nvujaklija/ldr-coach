import { useCallback, useEffect, useState } from "react";
import { RefreshControl, View } from "react-native";
import {
  createLetter,
  listLetters,
  openLetter,
  type Letter,
  type LetterBox,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { shortDate } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Body, Button, Card, Chip, ErrorText, Field, H1, H2, Muted, Row, Screen } from "@/theme/ui";
import { colors } from "@/theme/tokens";

function LetterCard({ letter, onOpen }: { letter: Letter; onOpen: (l: Letter) => void }) {
  return (
    <Card>
      <H2>{letter.title}</H2>
      <Muted>
        {letter.direction === "received" ? `From ${letter.from_name}` : `To ${letter.to_name}`} ·{" "}
        {shortDate(letter.created_at)}
      </Muted>
      {letter.is_locked ? (
        <Muted style={{ color: colors.dusk }}>🔒 Unlocks {shortDate(letter.visible_from)}</Muted>
      ) : letter.body !== null ? (
        <Body>{letter.body}</Body>
      ) : (
        <Button title="Open letter" onPress={() => onOpen(letter)} />
      )}
    </Card>
  );
}

export default function LettersScreen() {
  const { token, me } = useAuth();
  const [box, setBox] = useState<LetterBox>("inbox");
  const [letters, setLetters] = useState<Letter[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLetters(await listLetters(token, box));
      setError(null);
    } catch {
      setError("Couldn't load letters.");
    }
  }, [token, box]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function send() {
    if (!token || !title.trim() || !body.trim()) return;
    setBusy(true);
    try {
      await createLetter(token, { title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
      setBox("sent");
    } catch {
      setError("Couldn't send that letter.");
    } finally {
      setBusy(false);
    }
  }

  async function open(letter: Letter) {
    if (!token) return;
    try {
      const opened = await openLetter(token, letter.id);
      setLetters((cur) => cur.map((l) => (l.id === letter.id ? opened : l)));
    } catch {
      setError("This letter can't be opened yet.");
    }
  }

  const paired = !!me?.couple && me.couple.members.length >= 2;

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.dawn} />
      }
    >
      <H1 highlight="letters">Love</H1>
      <Muted>Heartfelt notes — send one now or lock it for later.</Muted>

      {paired && (
        <Card>
          <H2>Write a letter</H2>
          <Field label="Title" value={title} onChangeText={setTitle} placeholder="A little something" />
          <Field
            label="Message"
            value={body}
            onChangeText={setBody}
            multiline
            placeholder="Pour your heart out…"
          />
          <Button
            title="Send letter"
            onPress={send}
            loading={busy}
            disabled={busy || !title.trim() || !body.trim()}
          />
          <ErrorText>{error}</ErrorText>
        </Card>
      )}

      <Row>
        <Chip label="Inbox" selected={box === "inbox"} onPress={() => setBox("inbox")} />
        <Chip label="Sent" selected={box === "sent"} onPress={() => setBox("sent")} />
      </Row>

      {letters.length === 0 ? (
        <EmptyState icon="✉️" title={box === "inbox" ? "No letters yet" : "Nothing sent yet"}>
          {paired
            ? box === "inbox"
              ? "Letters from your partner will appear here."
              : "Letters you send will appear here."
            : "Pair up with your partner to start exchanging letters."}
        </EmptyState>
      ) : (
        <View style={{ gap: 0 }}>
          {letters.map((l) => (
            <LetterCard key={l.id} letter={l} onOpen={open} />
          ))}
        </View>
      )}
    </Screen>
  );
}
