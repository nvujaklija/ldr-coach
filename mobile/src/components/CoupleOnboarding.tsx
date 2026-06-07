import { useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import {
  ApiError,
  createCouple,
  createInvite,
  joinCouple,
  type Couple,
  type Invite,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Body, Button, Card, ErrorText, Field, H2, Muted } from "@/theme/ui";
import { colors } from "@/theme/tokens";

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

function CreateOrJoin() {
  const { token, refresh } = useAuth();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<Couple>) {
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card>
        <H2>Start your couple</H2>
        <Muted>Create a shared space, then invite your partner.</Muted>
        <Field
          label="Couple name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Alex & Sam"
        />
        <Button
          title="Create couple"
          disabled={busy || !name.trim()}
          loading={busy}
          onPress={() => run(() => createCouple(token!, name.trim()))}
        />
      </Card>

      <Card>
        <H2>Have an invite code?</H2>
        <Muted>Join the couple your partner already created.</Muted>
        <Field
          label="Invite code"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="e.g. ABCD2345"
        />
        <Button
          title="Join couple"
          disabled={busy || !code.trim()}
          loading={busy}
          onPress={() => run(() => joinCouple(token!, code.trim().toUpperCase()))}
        />
      </Card>

      <ErrorText>{error}</ErrorText>
    </>
  );
}

function InvitePartner() {
  const { token } = useAuth();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      setInvite(await createInvite(token));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function shareInvite() {
    if (!invite) return;
    try {
      await Share.share({
        message: `Join me on LDR Coach! Use code ${invite.code} or open ${invite.invite_url}`,
      });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  }

  return (
    <Card>
      <H2>Invite your partner</H2>
      {!invite ? (
        <>
          <Muted>Generate a one-time code your partner can use to join.</Muted>
          <Button title="Generate invite" onPress={generate} loading={busy} disabled={busy} />
        </>
      ) : (
        <>
          <Muted>Share this code with your partner:</Muted>
          <Body style={styles.code}>{invite.code}</Body>
          <Muted style={{ flexShrink: 1 }}>{invite.invite_url}</Muted>
          <Button title="Share invite" onPress={shareInvite} />
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function CoupleView({ couple }: { couple: Couple }) {
  const complete = couple.members.length >= 2;
  return (
    <>
      <Card>
        <H2>{couple.name}</H2>
        <View style={{ gap: 4 }}>
          {couple.members.map((m) => (
            <Body key={m.user_id}>• {m.display_name}</Body>
          ))}
        </View>
        {!complete && <Muted>Waiting for your partner to join.</Muted>}
      </Card>
      {!complete && <InvitePartner />}
    </>
  );
}

export function CoupleOnboarding() {
  const { me } = useAuth();
  if (!me) return null;
  return me.couple ? <CoupleView couple={me.couple} /> : <CreateOrJoin />;
}

const styles = StyleSheet.create({
  code: {
    fontSize: 26,
    letterSpacing: 8,
    fontWeight: "700",
    color: colors.accentStrong,
    fontVariant: ["tabular-nums"],
  },
});
