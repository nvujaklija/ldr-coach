import Constants from "expo-constants";

/**
 * Base URL for the FastAPI backend, including the `/api/v1` prefix.
 *
 * Resolution order (12-factor):
 *   1. EXPO_PUBLIC_API_URL — inlined at build time by Expo. Set it in
 *      `.env`, in the EAS build profile's `env`, or your shell.
 *   2. expo.extra.apiBaseUrl — from app.json, a convenient default per build.
 *   3. A localhost fallback for the simulator during development.
 *
 * On a physical iPhone, localhost points at the phone, not your Mac — use your
 * machine's LAN IP (e.g. http://192.168.1.20:8000/api/v1) or a deployed URL.
 */
const fromEnv = process.env.EXPO_PUBLIC_API_URL;
const fromExtra = (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
  ?.apiBaseUrl;

export const API_BASE = (fromEnv || fromExtra || "http://localhost:8000/api/v1").replace(
  /\/$/,
  "",
);
