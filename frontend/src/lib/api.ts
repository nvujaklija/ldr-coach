// Thin API client. The base URL comes from the environment so the same
// build works across deploys (12-factor). In the browser, requests go to
// the reverse proxy at /api by default.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export interface HealthResponse {
  status: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Health check failed: ${res.status}`);
  }
  return res.json();
}
