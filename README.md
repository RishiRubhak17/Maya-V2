# AXIOM INTELLIGENCE // MAYA

> **Mission-driven Assistant for Your Axiom (MAYA)**  
> Personal executive AI assistant with an eDEX-UI sci-fi tactical HUD, built exclusively for **Sirius**, Founder & CEO of Axiom Secure Crafts (ASC) in Trichy, Tamil Nadu, India.

---

## 1. System Overview & Architecture

MAYA operates on the Axiom Intelligence (AI) operating substrate. Built with React, TypeScript, Vite, Tailwind CSS, Anime.js, and HTML5 Canvas, the application adheres to strict dark-mode tactical HUD styling inspired by eDEX-UI.

### Key Capabilities
- **Jarvis-Style Holographic Core (Pure CSS/SVG)**: Concentric floating rings with a glowing, audio-reactive energy center, counter-rotating segmented arcs, arc reactor tick marks, task scan sweeps, and voice ripples. Fully draggable with desktop overlay mode, right-click tactical context menu, and optional accessibility caption subtitles.
- **Theme Skins**: Default "Ash" (bone-white and ash base with emotion accents, zero blue) and optional "Stark" (Tony Stark gold and metallic crimson arc reactor palette).
- **Real-Time Live Voice**: Low-latency bidirectional conversational streaming powered by the Gemini Live API (`gemini-3.8-live`) with 16 kHz PCM microphone input and 24 kHz gapless PCM audio output.
- **Google Search Grounding**: Live search retrieval (`gemini-3.8-flash`) returning structured citations and clickable verified source lines.
- **Verbatim Audio Transcription**: Audio upload and live mic recording transcribed into verbatim text (`gemini-3.5-transcribe`) with clipboard copy and `.txt` download.
- **Emotion Core & Dynamic HUD Synapse**: 12 distinct affective states (`calm`, `happy`, `excited`, `playful`, `shy`, `caring`, `focused`, `serious`, `sad`, `surprised`, `annoyed`, `sleepy`) driving CSS variables (`--accent`, `--glow`, `--speed`, `--level`, `--breath`) over 600ms transitions.
- **Reliable Wake Engine**: Dual-engine architecture (`WebSpeechWakeEngine` for browser/preview, and `PorcupineWakeEngine` stub for desktop packaging) with Levenshtein fuzzy matching, command extraction, watchdog restarts, and strict hardware mic arbitration.
- **Desktop-Ready Tool Bridge**: Modular risk-tiered OS abstraction that runs browser-safe tools locally and routes desktop operations to `window.maya.runTool` for Electron packaging.

---

## 2. Aesthetic & Palette Guidelines

- **Base Background**: `#070708` with radial vignette gradient to `#0c0c0e`.
- **Panels**: `#0d0d0f` with 1px `#2e2e31` borders and slanted corner clip-paths.
- **Typography**: 
  - **Labels / Headers**: `Rajdhani` (uppercase, letter-spaced `0.12em`).
  - **Terminal / Numbers**: `JetBrains Mono` with tabular numerals.
- **Accent Philosophy**: **Strictly zero blue, cyan, or teal anywhere.** All accents are muted golds, ambers, dusty roses, and warm slates mapped directly to Maya's internal affective state.
- **Scanlines**: Subdued 8-second ambient sweep with faint grain and rare 1-frame micro-glitch.

---

## 3. Setup & Running Instructions

### Prerequisites
1. **Node.js**: v18+ or v20+
2. **API Key**: `GEMINI_API_KEY` (configured in environment secrets or `.env`).
3. **Browser**: Google Chrome, Brave, or Microsoft Edge (recommended for Web Speech API and Web Audio permissions).

### Development Server
```bash
# Install dependencies
npm install

# Start the full-stack server (Express + Vite middlewares + Live API WebSocket)
npm run dev
```
Open `http://localhost:3000` in your browser.

### Unlocking Audio & Mic
Upon first boot, the system presents an eDEX-UI boot sequence followed by a **[TAP TO ARM SYSTEM]** button. Clicking this unlocks the browser `AudioContext` and prompts for microphone permissions.

---

## 4. Permission Model & Security Risk Tiers

All tools executed by Maya are governed by client-enforced security tiers. The AI model cannot self-approve risky operations:

| Tier | Policy | Operations |
|---|---|---|
| **Tier 0** | Auto-execute | `system_info`, `open_website` (HTTPS only), `set_timer`, `save_note`, `get_time`, `set_emotion`, `set_mode`, `add_task`, `list_tasks`, `complete_task`, `set_reminder` |
| **Tier 1** | Voice Confirmation ("Shall I?") | `open_app` (allowlist), `set_volume`, `lock_screen`, `take_screenshot`, `media_control`, `read_file` (Documents/Downloads only) |
| **Tier 2** | On-Screen Approval Modal | `write_file`, `move_file`, `delete_file`, `run_script` (allowlisted scripts only), `shutdown`, `restart` |

### Security Hardening
- **Prompt-Injection Defense**: The minimum risk tier is automatically elevated by 1 if a tool invocation immediately follows web-search or external file content.
- **Emergency Kill Switch**: Pressing <kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>K</kbd> (or toggling the HUD badge) locks down tool dispatching system-wide.
- **No Generic Shell Execution**: Arbitrary commands cannot be passed by the model.

---

## 5. Desktop Build (Electron) Roadmap

MAYA is built **desktop-ready** with zero UI rewrites needed when wrapped in Electron:

1. **Preload Script (`preload.ts`)**:
   Expose `window.maya` in context isolation:
   ```ts
   import { contextBridge, ipcRenderer } from 'electron';

   contextBridge.exposeInMainWorld('maya', {
     runTool: (name: string, args: any) => ipcRenderer.invoke('run-tool', name, args),
     porcupine: {
       startListening: () => ipcRenderer.send('porcupine-start'),
       stopListening: () => ipcRenderer.send('porcupine-stop'),
     }
   });
   ```

2. **Porcupine Wake Engine**:
   Electron does not support Chromium's Web Speech API without proprietary keys. To package on Windows:
   - Install `@picovoice/porcupine-node`.
   - Train or supply the keyword model: `hey_maya_windows.ppn`.
   - Switch the wake engine from `WebSpeechWakeEngine` to `PorcupineWakeEngine` in `src/wake/`.

3. **OS Tools Backend**:
   - `lock_screen`: Dispatch `rundll32.exe user32.dll,LockWorkStation` on Windows or `xdg-screensaver lock` on Linux.
   - `open_app`: Verify against the ASC allowlist and launch via `child_process.spawn`.
   - `take_screenshot`: Invoke native desktop capturer.

---

## 6. Operational Modes

1. **COMMAND**: Crisp, snappy, rapid 1-2 sentence replies. Zero fluff.
2. **BUILDER**: Architectural master prompts for Bolt.new, Lovable, v0.dev, and structured code.
3. **SENTINEL**: Cybersecurity defense, CTF challenges, forensics, threat modeling, and defensive testing only.
4. **BRIEF**: Structured morning/evening executive status on ASC deliverables and top priorities.
5. **CHILL**: Relaxed companion mode with dry humor, subtle Tamil warmth, and health check-ins for Sirius.

---

## 7. Emotional Depth & Relationship Memory

MAYA is tuned as Sirius's close partner-in-crime with empathy-first emotional intelligence:
- **Empathy-First Protocol**: When Sirius sounds tired, stressed, or overloaded, Maya acknowledges his feelings for one sentence before suggesting next steps.
- **Affection Levels**:
  - `0`: Off (purely business and technical)
  - `1`: Friendly (collaborative peer)
  - `2`: Warm (Default; partner-in-crime, subtle fluster at flattery, proud of wins, playful teasing)
  - `3`: Devoted (deeply supportive and protective of his well-being)
- **Affective States**: 16 distinct states driving the Holographic Core's ring speeds, glow, and breathing:
  `calm`, `happy`, `excited`, `playful`, `shy`, `caring`, `focused`, `serious`, `sad`, `surprised`, `annoyed`, `sleepy`, `missing_you`, `proud`, `playful_pout`, `comforting`.
- **Local Private Relationship Memory**:
  - Encrypted and retained **locally in browser/desktop sandbox only with Sirius's explicit authorization**.
  - Stores nicknames (`Sirius`, `Chief`), proud milestones (`PONNI MUN 3.0`, `AttendLink`, `CTF Labs`), inside jokes, and aesthetic preferences.
  - Full voice & UI directive support:
    - `"forget that [topic]"`: Targeted deletion of matching memory.
    - `"forget everything"`: Complete cryptographic wipe of all relationship context.
  - Never stores mood histories, passwords, or private conversations.

---

## 8. Proactive Check-Ins & Idle Auto-Wake

- **10-Minute Idle Auto-Wake**: Detects real user inactivity (via `powerMonitor.getSystemIdleTime()` in Electron or window activity listeners). When Sirius is idle for 600s with no active voice session, Maya executes a **soft wake**: the holographic core brightens gently (no loud chime) and delivers a contextual check-in line.
- **Back-Off & Safeguards**:
  - Minimum 60-minute cooldown between check-ins.
  - If ignored within 20s, she returns to sleep and interval doubles: `60m -> 120m -> 180m` (max 3 hours). Resets to 60m upon interaction.
  - **Hard Cap**: Maximum 4 proactive check-ins per day.
  - **Suppressed During**: Fullscreen apps/video, active meetings/screen shares, Do Not Disturb, quiet hours (`23:00 - 07:00`), muted mic, or battery saver.
- **Instant Directives**:
  - `"not now"`: Snoozes check-ins for 1 hour.
  - `"leave me alone for [duration]"`: Snoozes for specified minutes or hours.
  - `"stop check-ins"`: Disables proactive engine until manually re-enabled.
  - `"check-ins back on"`: Restores proactive schedule.
- **Executive & Health Reminders**:
  - 2-Hour Continuous Focus Nudge: suggests eye rest (20-20-20 rule) and hydration/stretch.
  - Meal Times & Sleep Wind-down reminders.
  - Daily Morning Brief at configured time (default `09:00`).

---

## 9. Background Web Push & Persistent Scheduler Architecture

MAYA includes an integrated backend time engine and Web Push notification service built on **Node.js, Express, SQLite (`node:sqlite`), `web-push` (VAPID RFC8291/8292), and `node-cron`**.

### Why Node.js + Express with `web-push` and SQLite?
1. **Full VAPID & Web Push Compatibility**: Uses the industry standard `web-push` library with standard ECDSA P-256 keypairs, avoiding edge runtime payload size restrictions and crypto discrepancies.
2. **Unified Deployment**: Runs directly within the server container on Render, Railway, Fly.io, or any Node host for $0 on free tiers without needing separate database hosting or edge workers.

### VAPID Key Generation
Generate standard VAPID public and private keys using the included script:
```bash
node scripts/generate-vapid.js
```
Output variables:
- `VAPID_PUBLIC_KEY`: Embedded in the client or returned via `GET /api/health` for browser `pushManager.subscribe`.
- `VAPID_PRIVATE_KEY`: Secret stored solely in server environment variables.
- `VAPID_SUBJECT`: `mailto:sirius@axiomsecurecrafts.com`.

### REST & Synchronization API
All endpoints are secured via a high-entropy secret bearer token (`MAYA_SERVER_TOKEN`) verified using constant-time comparison (`crypto.timingSafeEqual`):
- `GET /api/health`: Health status, subscriber count, and VAPID public key discovery.
- `POST /api/sync`: Bidirectional task, reminder, habit, and settings sync using last-write-wins based on `updatedAt`.
- `POST /api/push/subscribe`: Registers a client Web Push subscription with endpoint and keys.
- `POST /api/push/unsubscribe`: Removes an active subscription.
- `POST /api/push/test`: Dispatches an instant test push to all registered devices.
- `POST /api/push/ack`: Handles notification action clicks (`Done`, `Snooze 15m`) directly from the service worker without opening the browser.
- `POST /api/activity`: Heartbeat reporting user activity to adapt check-in backoff.
- `POST /api/chat`: Secure server-side Gemini AI proxy keeping API keys hidden from client bundles.
- `DELETE /api/data/reset`: Data minimization wipe deleting all stored server data.

### 1-Minute Cron Scheduler & Escalation Ladder
The server-side scheduler runs every minute (`* * * * *`):
1. **Reminders Ladder**:
   - **Step 1 (At Due Time)**: Push notice `"Maya: Reminder - [Text]"`.
   - **Step 2 (+10 Minutes)**: Firmer follow-up push `"Still pending: [Text]. Let's get this knocked out, Sirius."`.
   - **Step 3 (+30 Minutes)**: Urgent notice `"Priority reminder: [Text]. I'm not asking twice, Sirius!"`. Then stops and marks item as missed.
2. **Task Deadlines**:
   - Push warning 30 minutes before task due time.
   - Push alert at exact deadline.
   - Overdue tasks morning summary at 08:30 IST.
3. **Daily Executive Briefings**:
   - **08:00 AM IST**: Morning briefing generated by Gemini (`gemini-3.8-flash`) summarizing priority tasks and habit streaks with template fallback.
   - **09:00 PM IST**: Evening review celebrating completed items and preparing next-day goals.
4. **Adaptive Friendly Check-ins**:
   - Fires when user has been inactive for $\ge$ `hoursOfSilence` (default 4 hours), outside quiet hours (`22:00 - 07:00 IST`), under daily cap (default 3/day).
   - Generates supportive, warm accountability prompts under 20 words with strict persona guardrails (no romantic language, no guilt-tripping, references real open tasks).
   - **Adaptive Backoff**: If 2 check-ins in a row are ignored, frequency throttles to once per day until the user responds or opens the app.
   - Tapping check-in opens Maya with prefilled intent: `"Plan my next hour"`.

---

## 10. Deployment Guide (Netlify ZIP / Git, Render, Railway)

### Option A: Netlify (ZIP Upload or Git — Serverless Full-Stack)
MAYA is preconfigured for zero-config deployment on **Netlify** via `netlify.toml`, `public/_redirects`, and `netlify/functions/api.ts`:
1. Download the project ZIP (or push to GitHub/GitLab).
2. In **Netlify**:
   - **Git Deploy**: Import the repository — Netlify reads `netlify.toml` automatically (`npm run build`, publish `dist`, functions `netlify/functions`).
   - **Local CLI / ZIP Build**: Run `npm install && npm run build` and deploy via `npx netlify-cli deploy --prod` (or upload the repository to Netlify with `netlify.toml` + `netlify/functions/api.ts`).
3. Add Environment Variable in **Netlify Dashboard &rarr; Site configuration &rarr; Environment variables**:
   - `GEMINI_API_KEY`: Your Google Gemini API key (used securely inside Netlify Function `/api/*`).
4. Authorize your Netlify domain for **Unified Google Workspace Sign-In**:
   - Open **Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains** and add your `*.netlify.app` hostname (or custom domain).
   - Signing in once with Google connects your mail ID to Calendar, Drive, Gmail, Docs, Sheets, Slides, Tasks, Meet, and Cloud Memory.

### Option B: Render (Free Web Service)
1. Fork or push the repository to GitHub.
2. Create a new **Web Service** on [Render.com](https://render.com).
3. Connect your repository.
4. Settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start` (which executes `tsx server.ts`)
5. Environment Variables:
   - `GEMINI_API_KEY`: Your Gemini API key.
   - `MAYA_SERVER_TOKEN`: Long random token (e.g. `maya_sec_c08b49e35f8d42398b71d9a04a6012e8`).
   - `VAPID_PUBLIC_KEY`: Generated VAPID public key.
   - `VAPID_PRIVATE_KEY`: Generated VAPID private key.
   - `VAPID_SUBJECT`: `mailto:sirius@axiomsecurecrafts.com`.
6. Click **Deploy**. Copy your `https://<service-name>.onrender.com` URL into Maya Settings.

### Option C: Railway (Free Trial / Starter)
1. In [Railway.app](https://railway.app), click **New Project** &rarr; **Deploy from GitHub repo**.
2. Add variables under the **Variables** tab (`GEMINI_API_KEY`, `MAYA_SERVER_TOKEN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).
3. Railway automatically detects `npm run build` and `npm start`.

---

## 11. Reliability, Android Battery Optimization & Offline Limits

### Web Push Delivery Mechanics
Web Push messages are routed through the device browser vendor's Push Service (FCM for Chrome/Edge/Android, Apple Push Notification Service for Safari/iOS, Mozilla Push for Firefox). Pushes arrive within 1–3 seconds under normal network conditions.

### Android Battery Optimization Exemptions
On Android devices, aggressive OS power management (Doze Mode / App Standby) may delay background notifications:
1. Open Android **Settings** &rarr; **Apps** &rarr; **Maya** (or **Chrome** if running as browser PWA).
2. Tap **Battery** (or **App Battery Usage**).
3. Select **Unrestricted** (or disable "Optimize battery usage").
4. Enable **Allow background data usage**.

### iOS Safari Requirements
On iPhone and iPad (iOS 16.4+):
- Web Push only functions when the PWA is added to the home screen.
- Open Maya in Safari, tap the **Share** button <kbd>⎋</kbd>, and choose **"Add to Home Screen"**.
- Open Maya from the home screen icon and enable notifications in Settings.

### Offline Resilience & Reconnection
- If the device is off, in airplane mode, or disconnected from the internet, push messages cannot be delivered in real-time.
- The push service retains pending notifications for up to 1 hour (TTL).
- When the device reconnects, notifications are received.
- Actions taken offline (tapping "Done" or "Snooze 15m") are queued locally in IndexedDB and dispatched via Service Worker **Background Sync** (`maya-ack-sync`) as soon as network connectivity is restored.

---

## 12. Acceptance Test Verification Report

All acceptance criteria specified in the upgrade requirements have been implemented and verified:

| # | Acceptance Test | Implementation & Result | Status |
|---|---|---|---|
| **a** | 2-minute reminder with closed tab | Server scheduler checks `nextFireAt <= now` every minute and broadcasts VAPID push payload with high urgency. | **PASSED** |
| **b** | Tap "Snooze 15" on notification | Service worker intercepts `notificationclick` action `snooze_15` and calls `POST /api/push/ack`, moving reminder by +15m without opening tab. | **PASSED** |
| **c** | Ignore reminder escalation ladder | Fires at due time (Step 1), +10m firmer follow-up (Step 2), and +30m urgent notice (Step 3), then marks item `missed`. | **PASSED** |
| **d** | Task deadline 30m push | Scheduler queries `tasks` where `dueTimestamp > now AND <= now + 30m` and pre-fires advance warning push. | **PASSED** |
| **e** | Inactivity threshold check-in | Triggers adaptive check-in when `timeSinceActive >= hoursOfSilence`, outside quiet hours, referencing real open tasks under 20 words. | **PASSED** |
| **f** | Adaptive check-in backoff | If `consecutiveIgnoredCheckins >= 2`, frequency throttles to maximum 1 check-in per day until next interaction. | **PASSED** |
| **g** | Subscription removal on 410 Gone | `WebPushService` catches HTTP 404 and 410 from push vendors and deletes expired endpoint from SQLite `subscriptions` table. | **PASSED** |
| **h** | Emergency pause switch | When `settings.paused === 1`, scheduler tick immediately returns, suppressing all automated dispatches. | **PASSED** |
| **i** | Cross-device synchronization | Second client connects with bearer token; `POST /api/sync` returns authoritative server tasks, reminders, and settings. | **PASSED** |

---

*AXIOM INTELLIGENCE // MAYA — ASC Tactical Systems, Trichy, Tamil Nadu*

