# LDR Coach — Mobile (iOS)

A React Native + Expo client for the LDR Coach backend, packaged as a native
iOS app for TestFlight beta testing. It talks to the same FastAPI backend and
JWT auth as the web app, so accounts and data are shared.

The UI follows the web app's **"Two Skies"** aesthetic (warm dusk → cool dawn
over a deep night canvas), ported to native components.

## Features

Everything the web app does, as native screens:

- **Auth** — register / sign in with the same accounts (JWT stored in the iOS
  Keychain via `expo-secure-store`).
- **Home** — greeting, days-together counter, couple onboarding (create / join /
  invite via the iOS share sheet), daily check-in, next-visit countdown.
- **Rituals** — create from templates, mark instances done, pause / resume.
- **BeReal** — enable/disable, capture the daily moment with the camera, view
  shared history.
- **Letters** — write, send, inbox / sent, open time-locked letters.
- **Memories** — shared timeline with quick note capture.
- **Bucket List** — add items, cycle status (planned → in progress → done).
- **Visits** — plan, view countdown, update status.
- **Settings** — notification toggles, time zone, log out.
- **Notifications** — in-app reminders, mark read / mark all read.

## Tech

- Expo SDK 54 (React Native 0.81, React 19), TypeScript, New Architecture.
- `expo-router` for file-based navigation (`src/app`).
- `expo-secure-store`, `expo-notifications`, `expo-image-picker`,
  `expo-linear-gradient`, `expo-image`.

## Project layout

```
mobile/
  app.json              Expo config (iOS bundle id, plugins, permissions, EAS)
  eas.json              EAS build + submit profiles (development/preview/production)
  .env.example          EXPO_PUBLIC_API_URL template
  src/
    app/                expo-router routes
      _layout.tsx       root: providers + stack
      index.tsx         auth gate / redirect
      login.tsx
      register.tsx
      (app)/            authenticated area (auth guard)
        _layout.tsx     stack: tabs + pushable screens
        (tabs)/         Home · Rituals · BeReal · Letters · More
        memories.tsx · bucket-list.tsx · visits.tsx · settings.tsx · notifications.tsx
    components/         CheckInCard, CoupleOnboarding, NextVisitWidget, EmptyState
    lib/               api.ts, auth.tsx, config.ts, format.ts, notifications.ts
    theme/             tokens.ts (Two Skies palette), ui.tsx (shared primitives)
```

## Local development

```bash
cd mobile
npm install
cp .env.example .env        # then set EXPO_PUBLIC_API_URL
npm run ios                 # opens the iOS simulator (requires Xcode)
```

> **API base URL.** The client reads `EXPO_PUBLIC_API_URL` (falling back to
> `expo.extra.apiBaseUrl` in `app.json`, then `http://localhost:8000/api/v1`).
> On a **physical iPhone**, `localhost` is the phone itself — use your Mac's LAN
> IP (e.g. `http://192.168.1.20:8000/api/v1`). TestFlight builds must point at a
> publicly reachable **HTTPS** backend.

Type-check with `npm run typecheck`.

---

## iOS TestFlight Setup

### Prerequisites

- Apple Developer account ($99/year).
- Expo account (free or paid) — sign in with `eas login`.
- Node.js + EAS CLI installed:
  ```bash
  npm install -g eas-cli
  ```
- A backend reachable over HTTPS from the internet (set `EXPO_PUBLIC_API_URL`
  to it for the build — see Step 3).

### Step 0: Link the Expo project

From `mobile/`:

```bash
eas login
eas init                 # creates the EAS project and fills in the project id
```

`eas init` writes the real `extra.eas.projectId` into `app.json` (replacing the
`YOUR_EAS_PROJECT_ID` placeholder) and sets `owner`. Confirm
`ios.bundleIdentifier` is `com.nvujaklija.ldrcoach` (or change it to your own —
it must be globally unique).

### Step 1: Create the app in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. **My Apps → "+" → New App**.
3. Choose:
   - Platform: iOS
   - Name: **LDR Coach** (or your chosen name)
   - Primary language: English
   - Bundle ID: select the one matching `ios.bundleIdentifier` in `app.json`
     (`com.nvujaklija.ldrcoach`). If it isn't listed, EAS will register it for
     you the first time you build, or create it under Certificates, IDs &
     Profiles.
   - SKU: e.g. `ldrcoach`
4. Save. Note the **App Store Connect App ID** (the numeric `ascAppId`) — put it
   in `eas.json` under `submit.production.ios.ascAppId`, along with your Apple ID
   email (`appleId`) and Team ID (`appleTeamId`).

### Step 2: Confirm the config

`app.json` already contains:

```json
"ios": { "bundleIdentifier": "com.nvujaklija.ldrcoach" },
"extra": { "eas": { "projectId": "YOUR_EAS_PROJECT_ID" } }
```

`eas.json` already has `production` and `preview` build profiles that target iOS
(non-simulator `.ipa`), plus a `submit.production.ios` block. Replace the
`YOUR_*` placeholders with your real values.

### Step 3: Build for TestFlight

From `mobile/`, with the API URL baked into the build:

```bash
# Point the build at your deployed HTTPS backend
EXPO_PUBLIC_API_URL=https://api.your-domain.com/api/v1 \
  eas build --platform ios --profile production
```

(Equivalently: `npm run build:ios`.) This will:

- Provision credentials (let EAS manage your signing certificate & provisioning
  profile when prompted — easiest path).
- Build the iOS app in the cloud and produce an `.ipa`.

You can also set `EXPO_PUBLIC_API_URL` in the profile's `env` block in `eas.json`
so you don't pass it each time.

### Step 4: Upload to App Store Connect

```bash
eas submit --platform ios --profile production
```

(Equivalently: `npm run submit:ios`.) Pick the build you just made. EAS uploads
the `.ipa` to App Store Connect / TestFlight. The build then takes a few minutes
to finish "Processing".

### Step 5: Add testers

For one or two people, **internal testing** is fastest (no App Review):

1. App Store Connect → your app → **TestFlight**.
2. Add your girlfriend's Apple ID email to **Users and Access** as a tester (or
   to an Internal Testing group).
3. Assign the processed build to the group.

For more people, use **External Testing** (requires a short Beta App Review):
add a build, fill in "What to Test" + a test info email, add tester emails, and
submit for review.

### Step 6: Install on the iPhone

1. Install the **TestFlight** app from the App Store.
2. Open the invite email → **View in TestFlight** → **Install**.
3. On first launch the app connects to the backend (`EXPO_PUBLIC_API_URL`) and
   you can sign in with the same account as the web app.

### Step 7: Shipping updates

```bash
eas build --platform ios --profile production && eas submit --platform ios --profile production
```

`autoIncrement` in the production profile bumps the build number automatically.
Testers get a notification and update from within TestFlight. For JS-only
changes you can later add EAS Update (OTA) to skip rebuilds.

---

## Notes

- The backend API is unchanged — the mobile app uses the same endpoints and JWT
  auth as the web app.
- JWT is stored securely on-device via `expo-secure-store` (iOS Keychain).
- **Push notifications:** the client side is wired (`src/lib/notifications.ts`
  requests permission, sets the foreground handler, and fetches the Expo push
  token). Delivering remote BeReal-moment pushes additionally needs a backend
  endpoint to store the device token and send via Expo's push service — that
  endpoint isn't in the API yet. In-app notifications already work today.
- iOS-only for now; the Android keys in `app.json` are harmless and can be used
  later without restructuring.
