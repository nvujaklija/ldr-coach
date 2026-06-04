"use client";

import { useState } from "react";
import { ApiError, createCouple, createInvite, joinCouple, type Couple, type Invite } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Something went wrong";
}

/** Shown when the signed-in user has not yet created or joined a couple. */
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
      <div className="card">
        <h2>Start your couple</h2>
        <p className="muted">Create a shared space, then invite your partner.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createCouple(token!, name));
          }}
        >
          <div className="field">
            <label htmlFor="couple-name">Couple name</label>
            <input
              id="couple-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex & Sam"
              required
            />
          </div>
          <button type="submit" disabled={busy}>
            Create couple
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Have an invite code?</h2>
        <p className="muted">Join the couple your partner already created.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => joinCouple(token!, code.trim().toUpperCase()));
          }}
        >
          <div className="field">
            <label htmlFor="join-code">Invite code</label>
            <input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. ABCD2345"
              required
            />
          </div>
          <button type="submit" disabled={busy}>
            Join couple
          </button>
        </form>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

/** Generates and displays a shareable invite for the partner. */
function InvitePartner() {
  const { token } = useAuth();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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

  async function copy() {
    if (!invite) return;
    try {
      await navigator.clipboard.writeText(invite.invite_url);
      setCopied(true);
    } catch {
      // Clipboard unavailable (e.g. insecure context) — the link is still visible.
    }
  }

  return (
    <div className="card">
      <h2>Invite your partner</h2>
      {!invite ? (
        <>
          <p className="muted">
            Generate a one-time code your partner can use to join.
          </p>
          <button type="button" onClick={generate} disabled={busy}>
            {busy ? "Generating…" : "Generate invite"}
          </button>
        </>
      ) : (
        <>
          <p>Share this code with your partner:</p>
          <p className="code">{invite.code}</p>
          <p className="muted" style={{ wordBreak: "break-all" }}>
            {invite.invite_url}
          </p>
          <button type="button" onClick={copy}>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Shows the couple and its members once at least the first partner is in. */
function CoupleView({ couple }: { couple: Couple }) {
  const complete = couple.members.length >= 2;
  return (
    <>
      <div className="card">
        <h2>{couple.name}</h2>
        <ul>
          {couple.members.map((m) => (
            <li key={m.user_id}>{m.display_name}</li>
          ))}
        </ul>
        {!complete && (
          <p className="muted">Waiting for your partner to join.</p>
        )}
      </div>
      {!complete && <InvitePartner />}
    </>
  );
}

export default function CoupleOnboarding() {
  const { me } = useAuth();
  if (!me) return null;
  return me.couple ? <CoupleView couple={me.couple} /> : <CreateOrJoin />;
}
