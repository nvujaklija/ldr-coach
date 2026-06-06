"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCheckIns, getNextVisit, listRituals } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface Step {
  title: string;
  detail: string;
  done: boolean;
  href: string;
  cta: string;
}

/**
 * Friendly "get set up" checklist on the Home page. Pulls the couple state
 * from the session and probes the feature endpoints to mark each step done.
 */
export default function OnboardingChecklist() {
  const { token, me } = useAuth();
  const [hasVisit, setHasVisit] = useState(false);
  const [hasCheckIn, setHasCheckIn] = useState(false);
  const [hasRitual, setHasRitual] = useState(false);

  const paired = (me?.couple?.members.length ?? 0) >= 2;

  useEffect(() => {
    if (!token || !me?.couple) return;
    let active = true;
    getNextVisit(token)
      .then((v) => active && setHasVisit(v !== null))
      .catch(() => {});
    getCheckIns(token, 30)
      .then((list) => active && setHasCheckIn(list.check_ins.length > 0))
      .catch(() => {});
    listRituals(token)
      .then((rs) => active && setHasRitual(rs.length > 0))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token, me?.couple]);

  const steps: Step[] = [
    {
      title: "Create your account",
      detail: "You're signed in — nice to have you here.",
      done: true,
      href: "/app",
      cta: "Done",
    },
    {
      title: "Start your couple",
      detail: "Create your shared space or join with an invite code.",
      done: Boolean(me?.couple),
      href: "/app/settings",
      cta: "Set up",
    },
    {
      title: "Invite your partner",
      detail: "Share a code so you can be in this together.",
      done: paired,
      href: "/app/settings",
      cta: "Invite",
    },
    {
      title: "Plan your next visit",
      detail: "Add a trip and start the countdown.",
      done: hasVisit,
      href: "/app",
      cta: "Plan",
    },
    {
      title: "Share your first check-in",
      detail: "Let each other know how you're feeling today.",
      done: hasCheckIn,
      href: "/app",
      cta: "Check in",
    },
    {
      title: "Schedule a ritual",
      detail: "A recurring date keeps the spark alive.",
      done: hasRitual,
      href: "/app/rituals",
      cta: "Add",
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const pct = Math.round((completed / steps.length) * 100);

  if (completed === steps.length) return null;

  return (
    <section className="card" aria-labelledby="onboarding-heading">
      <h2 id="onboarding-heading">Getting started</h2>
      <p className="muted">
        {completed} of {steps.length} done — a few small steps to settle in.
      </p>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Onboarding progress"
      >
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <ul className="checklist">
        {steps.map((step) => (
          <li key={step.title} className={step.done ? "done" : undefined}>
            <span className="check-mark" aria-hidden="true">
              {step.done ? "✓" : ""}
            </span>
            <span className="check-body">
              <span className="check-title">{step.title}</span>
              <span className="muted">{step.detail}</span>
              {!step.done && (
                <Link href={step.href}>{step.cta} →</Link>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
