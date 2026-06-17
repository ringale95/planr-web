// Client-side Google Calendar integration via Google Identity Services (GIS).
// Works on a static site (GitHub Pages) — no backend. Needs a Google OAuth
// "Web application" client ID, set once by the user (see README / Settings).

const CID_KEY = "planr.gcal.clientId";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";

let tokenClient: any = null;
let accessToken = "";
let gisLoaded = false;

export function getClientId(): string {
  return localStorage.getItem(CID_KEY) || "";
}
export function setClientId(v: string): void {
  localStorage.setItem(CID_KEY, v.trim());
}
export function isConnected(): boolean {
  return !!accessToken;
}

function loadGis(): Promise<void> {
  if (gisLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => {
      gisLoaded = true;
      resolve();
    };
    s.onerror = () => reject(new Error("Failed to load Google sign-in"));
    document.head.appendChild(s);
  });
}

/** Trigger Google sign-in + consent; resolves true if we got an access token. */
export async function connect(): Promise<boolean> {
  const clientId = getClientId();
  if (!clientId) throw new Error("Add your Google OAuth client ID first.");
  await loadGis();
  const google = (window as any).google;
  return new Promise<boolean>((resolve) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp: any) => {
        accessToken = resp?.access_token || "";
        resolve(!!accessToken);
      },
      error_callback: () => resolve(false),
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

/** Push a single appointment to the user's primary Google Calendar. */
export async function pushEvent(a: {
  title: string;
  date: string;
  startTime: string;
  durationMin: number;
}): Promise<boolean> {
  if (!accessToken) return false;
  const start = new Date(`${a.date}T${a.startTime}:00`);
  const end = new Date(start.getTime() + a.durationMin * 60000);
  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: `Planr · ${a.title}`,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
