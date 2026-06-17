# Planr — web

Calm, mobile-first, rule-based personal scheduler. Offline-first (localStorage); optional
sync to a private home backend ([planr-api](../planr-api)).

## Run locally
```bash
npm install
npm run dev      # http://localhost:5173  (also on your LAN IP for phone access)
npm run build    # production build to dist/
```

## Deploy to GitHub Pages
A workflow at `.github/workflows/deploy.yml` builds and publishes on every push to `main`.

One-time setup:
1. Create a **public** GitHub repo named `planr-web` (empty — no README).
2. From this folder:
   ```bash
   git remote add origin git@github.com:<your-username>/planr-web.git
   git push -u origin main
   ```
3. The Action runs, enables Pages, and deploys. Your app:
   `https://<your-username>.github.io/planr-web/`

(Vite `base` is `./` so it works on the project sub-path.)

## Add to phone home screen
Open the Pages URL on your phone → Share → **Add to Home Screen**. The manifest +
icons give it a proper Planr icon and full-screen launch.

## Connect Google Calendar (optional)
Client-side OAuth (no backend). One-time Google setup:
1. Go to <https://console.cloud.google.com/> → create a project.
2. **APIs & Services → Library →** enable **Google Calendar API**.
3. **OAuth consent screen** → External → add yourself as a test user.
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   - **Authorized JavaScript origins:** add your Pages origin
     `https://<your-username>.github.io` (and `http://localhost:5173` for local).
5. Copy the **Client ID** (`…apps.googleusercontent.com`).
6. In Planr → **Goals** tab → Google Calendar → paste the Client ID → **Connect**.

After connecting, appointments you add in Planr are mirrored to your primary Google
Calendar. (The access token lasts ~1 hour per session; reconnect when needed.)

> Note: there is **no Scaler integration** — Scaler has no public API. Class times are
> built into the schedule; if Scaler sends `.ics` invites, those can be imported into
> Google Calendar directly.
