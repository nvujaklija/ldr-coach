"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";

type Status = "loading" | "ok" | "error";

export default function BackendStatus() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let active = true;
    getHealth()
      .then((res) => active && setStatus(res.status === "ok" ? "ok" : "error"))
      .catch(() => active && setStatus("error"));
    return () => {
      active = false;
    };
  }, []);

  const label =
    status === "loading"
      ? "Checking…"
      : status === "ok"
        ? "API connected"
        : "API unreachable";

  return (
    <p role="status" data-status={status}>
      Backend status: <strong>{label}</strong>
    </p>
  );
}
