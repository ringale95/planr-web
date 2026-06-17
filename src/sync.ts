import type { AppState } from "./types";

// Default to the home laptop's LAN IP over HTTPS. Override anytime via
// localStorage.setItem("planr.api", "https://<ip>:<port>") or "" to disable.
const DEFAULT_API = "https://10.0.0.151:8443";
const API_KEY = "planr.api";
const LAST_SYNC_KEY = "planr.lastSyncedAt";

export function lastSyncedAt(): number {
  return Number(localStorage.getItem(LAST_SYNC_KEY) || 0);
}

export function apiBase(): string {
  const v = localStorage.getItem(API_KEY);
  if (v != null) return v; // explicit override always wins
  // Served from the backend itself (home LAN / localhost) → sync same-origin, no cert/CORS.
  if (typeof location !== "undefined" && !location.hostname.endsWith("github.io")) {
    return location.origin;
  }
  // On the public GitHub Pages site → talk to the (HTTPS) home backend if reachable.
  return DEFAULT_API;
}

export function setApiBase(v: string): void {
  localStorage.setItem(API_KEY, v.trim());
}

/** Probe the home backend; returns its last-synced timestamp, or null if unreachable. */
export async function health(): Promise<{ ok: boolean; updatedAt: number } | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await withTimeout(`${base}/health`, {}, 2500);
    if (!res.ok) return null;
    return (await res.json()) as { ok: boolean; updatedAt: number };
  } catch {
    return null;
  }
}

interface Snapshot {
  updatedAt: number;
  state: AppState;
}

async function withTimeout(input: string, init: RequestInit = {}, ms = 2500): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

/** Pull server snapshot if reachable; null if offline/away/error. */
export async function pullState(): Promise<Snapshot | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await withTimeout(`${base}/state`);
    if (!res.ok) return null;
    const data = (await res.json()) as { updatedAt: number; state: AppState | null };
    if (!data.state) return null;
    return { updatedAt: data.updatedAt, state: data.state };
  } catch {
    return null; // offline-first: never throw into the UI
  }
}

/** Push local snapshot to the home backend (fire-and-forget safe). */
export async function pushState(state: AppState): Promise<boolean> {
  const base = apiBase();
  if (!base) return false;
  try {
    const res = await withTimeout(`${base}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updatedAt: state.updatedAt, state }),
    });
    if (res.ok) localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    return res.ok;
  } catch {
    return false;
  }
}
