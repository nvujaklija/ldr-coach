"use client";

import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import PageHeader from "@/components/PageHeader";
import {
  getBeRealStatus,
  listBeRealMoments,
  postBeRealPhoto,
  type BeRealMoment,
  type BeRealStatus,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

/** Format a UTC instant in a given IANA timezone for display. */
function formatInZone(iso: string | null, tz?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz || undefined,
    });
  } catch {
    return new Date(iso).toLocaleString();
  }
}

/** The shared photos for a moment, once they are visible to the viewer. */
function MomentPhotos({ moment }: { moment: BeRealMoment }) {
  if (moment.posts.length === 0) return null;
  return (
    <div className="bereal-photos">
      {moment.posts.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p.id} src={p.image_url} alt="BeReal moment" className="bereal-photo" />
      ))}
    </div>
  );
}

/** The post box for the live moment: upload, then wait for the partner. */
function ActiveMoment({
  moment,
  onPosted,
}: {
  moment: BeRealMoment;
  onPosted: (m: BeRealMoment) => void;
}) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setBusy(true);
    setError(null);
    try {
      onPosted(await postBeRealPhoto(token, moment.id, file));
    } catch {
      setError("Could not upload your photo");
    } finally {
      setBusy(false);
    }
  }

  if (moment.you_posted) {
    return (
      <section className="card">
        <h2>BeReal moment</h2>
        {moment.partner_posted ? (
          <p className="muted">You both posted — here&apos;s your moment together.</p>
        ) : (
          <p className="muted">
            Posted! Your partner&apos;s photo unlocks once they post theirs.
          </p>
        )}
        <MomentPhotos moment={moment} />
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Post your BeReal ⏰</h2>
      <p className="muted">
        It&apos;s time! Snap a photo now — you&apos;ll see your partner&apos;s once you both post.
      </p>
      <label>
        Your photo
        <input type="file" accept="image/*" onChange={upload} disabled={busy} />
      </label>
      {busy && <p role="status">Uploading…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}

/** Main BeReal page: live moment, next scheduled times, and past moments. */
export default function BeRealView() {
  const { token } = useAuth();
  const [status, setStatus] = useState<BeRealStatus | null>(null);
  const [past, setPast] = useState<BeRealMoment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!token) return;
    getBeRealStatus(token)
      .then(setStatus)
      .catch(() => setError("Could not load BeReal"));
    listBeRealMoments(token)
      .then((r) => setPast(r.moments))
      .catch(() => {
        /* history is a nice-to-have */
      });
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <p role="alert" className="error">
        {error}
      </p>
    );
  }
  if (!status) {
    return (
      <p role="status" className="muted">
        Loading BeReal…
      </p>
    );
  }

  const moment = status.current_moment;
  const liveNow = moment?.is_open ?? false;
  // Completed moments to show in the gallery (exclude any still-live one).
  const history = past.filter((m) => m.status === "completed" && m.id !== moment?.id);

  return (
    <>
      <PageHeader
        title="BeReal moments 📸"
        subtitle="A surprise daily prompt to snap a photo at the same time as your partner — always within both of your daytime hours."
      />

      {!status.is_active && (
        <section className="card">
          <h2>BeReal is off</h2>
          <p className="muted">
            Turn it on in Settings to start getting a shared daily photo prompt.
          </p>
        </section>
      )}

      {liveNow && moment ? (
        <ActiveMoment
          moment={moment}
          onPosted={(m) =>
            setStatus((s) => (s ? { ...s, current_moment: m } : s))
          }
        />
      ) : (
        status.is_active && (
          <section className="card">
            <h2>Next BeReal</h2>
            {status.next_utc ? (
              <>
                <p className="muted">
                  A surprise moment is coming — keep an eye out around:
                </p>
                <ul className="bereal-times">
                  {status.partners.map((p) => (
                    <li key={p.user_id}>
                      <strong>{p.display_name}</strong>{" "}
                      <span className="muted">
                        {formatInZone(p.local_time, p.timezone)} ({p.timezone})
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="muted">No moment scheduled yet — check back soon.</p>
            )}
          </section>
        )
      )}

      {history.length > 0 && (
        <section className="card">
          <h2>Past moments</h2>
          <ul className="bereal-history">
            {history.map((m) => (
              <li key={m.id}>
                <span className="muted">{formatInZone(m.scheduled_utc)}</span>
                <MomentPhotos moment={m} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
