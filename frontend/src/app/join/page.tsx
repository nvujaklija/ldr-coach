"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { ApiError, joinCouple } from "@/lib/api";
import { useAuth } from "@/lib/auth";

function JoinContent() {
  const params = useSearchParams();
  const code = (params.get("code") ?? "").trim().toUpperCase();
  const { token, me, refresh } = useAuth();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function join() {
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      await joinCouple(token, code);
      await refresh();
      router.replace("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  // Already part of a couple — nothing to join.
  if (me?.couple) {
    return (
      <>
        <p>You&apos;re already part of {me.couple.name}.</p>
        <button type="button" onClick={() => router.replace("/app")}>
          Go to your dashboard
        </button>
      </>
    );
  }

  return (
    <>
      <h1>Join your partner</h1>
      {code ? (
        <>
          <p>
            You were invited with code <span className="code">{code}</span>.
          </p>
          <button type="button" onClick={join} disabled={busy}>
            {busy ? "Joining…" : "Accept invite"}
          </button>
        </>
      ) : (
        <p className="error" role="alert">
          This invite link is missing a code.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function Guarded() {
  const params = useSearchParams();
  const code = params.get("code") ?? "";
  return (
    <RequireAuth returnTo={`/join?code=${encodeURIComponent(code)}`}>
      <JoinContent />
    </RequireAuth>
  );
}

export default function JoinPage() {
  return (
    <main>
      <Suspense fallback={<p>Loading…</p>}>
        <Guarded />
      </Suspense>
    </main>
  );
}
