# CallMitra AI

Your Personal AI Calling Companion. By Rash Production.

React Native + Expo (SDK 58) + TypeScript + Expo Router.

## Download (Android)

https://github.com/rkblazeofficial-pixel/callmitra-ai/releases/latest/download/CallMitra-AI.apk

Open the link on an Android phone, download, and install (allow "Install unknown apps" for your browser when asked).
The file is rebuilt by GitHub Actions on every push to `main`.

## Current status: DEMO build (v0.1.0)

Working now:
- Two intros on first launch only (CallMitra AI, then Rash Production), normal launches skip them.
- Welcome, sign up, log in, reset password, profile setup (accounts live **on the device only**).
- Home dashboard, contacts (add/edit/delete/import, groups, duplicate blocking, consent), call history, settings.
- Create-call flow: occasion, recipient, message, script generator, edit/regenerate/save draft, voice selection, conversation preview, consent check, opt-out blocking.
- Call screen with waveform and states.

Not live yet (clearly labelled DEMO inside the app):
- **No real calls are placed.** The call screen is a scripted simulation and is recorded as DEMO in history.
- The script generator is a local, rule-based demo. It arranges only what the user wrote and never invents facts. The real LLM-based generator needs the backend.
- Voice preview, scheduling, OTP/email verification, cloud accounts, credits (the backend and schema for these exist but are not connected to the app yet).

## What live calling needs (verified with the Thunder Phone account)

1. A ThunderPhone **phone number** (the account has none yet).
2. **Outbound calling approval** from ThunderPhone (admin request at https://app.thunderphone.com/outbound-request).
3. A ThunderPhone **agent** per call (created and deployed by the backend), with the selected voice and language.
4. A **backend** (Node/Fastify) holding the API keys, with a webhook endpoint for call status, plus **Supabase** for accounts, RLS and records.
5. Confirmation that the invitation/greeting use case, DND/NCPR rules and calling hours are permitted for Indian numbers on the chosen number type.

ThunderPhone supports all requested languages (Hindi, English, Punjabi, Bengali, Marathi, Gujarati, Tamil, Telugu, Kannada, Malayalam). Hinglish has no separate code and uses the Hindi voices. Voice pairings for Hindi and English were verified; the regional ones follow the provider's defaults and must be re-verified once connected.


## Backend (`backend/`) and database (`supabase/`)

Built and tested, **not deployed and not yet connected to the app**.

- `backend/`: Fastify + TypeScript. `POST /v1/calls` (auth, consent, opt-out, calling-hours, daily-limit and duplicate-call guards, then the provider), `GET /v1/calls/:id`, `POST /webhooks/thunderphone` (signed, replay-protected, de-duplicated).
- Provider-independent: `CallProvider` interface with a ThunderPhone adapter (`src/providers/thunderphone.ts`). Another provider only needs to implement the same interface.
- `src/prompt.ts` builds the live-conversation rules: discloses it is an AI, uses only supplied facts, never invents details, ends on opt-out or goodbye, no voicemail messages.
- `supabase/migrations/0001_init.sql`: all required tables, Row Level Security on every table, duplicate-number and duplicate-call constraints.
- Tests: `cd backend && npm test` (66 tests, including the RLS migration run in a real in-process Postgres and ThunderPhone's official webhook-signature test vector).

Honest status of what is verified:
- Verified by automated tests: the guards, webhook signatures, request building against ThunderPhone's documented schema (mocked HTTP), user isolation in SQL.
- **Not verified against the live ThunderPhone API.** The account has no phone number and no outbound approval, so no real call has been placed.
- The server refuses to start with `LIVE_CALLING_ENABLED=true` until the Supabase-backed store replaces the in-memory one, so opt-outs can never be lost on restart.

### India-specific finding

ThunderPhone does not sell phone numbers in India. Options: (a) a US ThunderPhone number (works, but people in India see an international number and the agent's calls to India cost about 3.8 to 4.4 cents per minute), or (b) connect your own Indian number from a carrier or SIP provider as a VoIP connection. Whether an Indian carrier allows AI-voiced invitation calls, and DND/NCPR obligations, must be confirmed with that carrier before going live. The app does not bypass DND.

## Run locally

```bash
npm install
npx expo start
```

## Build the APK yourself

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

The release APK is signed with the debug keystore, which is fine for sharing and sideloading but **not for Play Store**. For the Play Store create a proper upload keystore and store it in GitHub Secrets.

## Secrets

Never commit keys. See `.env.example` (backend only).
