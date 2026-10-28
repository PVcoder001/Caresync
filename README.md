# CareSync — Smart Caregiver-Synced AI Health Companion for Medication Adherence

![CareSync](https://img.shields.io/badge/Status-Demo%20Build-14b8a6) ![Tech](https://img.shields.io/badge/Tech-HTML%20%7C%20CSS%20%7C%20Vanilla%20JS-6366f1) ![Storage](https://img.shields.io/badge/Storage-localStorage-f59e0b) ![License](https://img.shields.io/badge/License-MIT-green)

**CareSync** is a zero-dependency, browser-based health companion that helps patients stay on track with medications, keeps caregivers in the loop, and provides AI-style coaching — all without a backend or build step.

> ⚠️ **Disclaimer:** CareSync is a demo build for educational and decision-support purposes only. It is not a medical device, does not provide medical advice, diagnosis, or treatment, and should not replace consultation with a qualified healthcare professional. For medical emergencies, call your local emergency services.

---

## ✨ Features

### 📊 Adherence Dashboard
- **Live Adherence Ring** — Visual tracking of today's doses with taken/due/missed/skipped breakdown
- **Smart KPIs** — Today's adherence, 7-day adherence, perfect-day streak, and refill alerts
- **Today's Schedule** — One-tap **Taken / Skip / Undo** with instant sync to caregivers
- **7-Day Trend Chart** — Canvas-based chart with 80% goal line and color-coded performance
- **Smart Reminders** — 60-minute grace window with in-app toasts and optional browser notifications

### 💊 Medications & Refills
- **Multi-dose Scheduling** — Add medications with up to 6 daily times (validated 24-hour format)
- **Pill Tracking** — Automatic decrement on dose logging, with supply countdown ("≈X days left")
- **Smart Refill Alerts** — Warns when supply falls below 20% or < 3 days remaining
- **Colour Tags & Instructions** — Organize by medication with notes like "Take with food"
- **Easy Management** — Add, edit, or remove medications on the fly

### 🤖 AI Health Companion
- **Context-Aware Chat** — Rule-based companion that reads your live schedule and adherence data
- **Schedule Queries** — Ask "What's my next dose?", "How am I doing?", or "Any refills due?"
- **Missed Dose Coaching** — Safe guidance on what to do if you forget a dose (never suggests doubling up)
- **Red-Flag Detection** — Flags symptoms like dizziness, shortness of breath, or chest pain with emergency guidance
- **Refill & Caregiver Status** — Instant answers about supply and who's linked to your care team
- **Persistent History** — Chat history saved to localStorage (up to 80 messages)

### 👨‍👩‍👧 Caregiver Sync
- **Shareable Sync Code** — Unique `CS-XXXX-XXXX` code to share with family/care staff
- **Multiple Caregivers** — Link family, friends, nurses, or doctors with custom alert levels
- **Alert Levels** — Choose from *All activity*, *Misses & alerts only*, or *Weekly summary*
- **Live Alert Feed** — Missed doses (last 7 days), low refills, severe side effects, and wins
- **Sync Controls** — Manual sync, weekly report, and share/pause toggle
- **Last-Sync Timestamp** — Always know when caregivers were last updated

### 📝 Side-Effect & Journal Tracking
- **Severity Rating** — 1 (Minimal) to 5 (Extreme) slider with visual feedback
- **Medication Linkage** — Associate symptoms with specific medications or log generally
- **Entry Types** — Symptom, Mood, Vitals note, Doctor visit, or Other
- **Auto-Escalation** — Severity ≥ 4 automatically alerts your caregivers
- **Timeline View** — Chronological history with type, severity, and timestamps

### 🎨 UI/UX
- **Modern Healthcare Design** — Clean teal/indigo theme with smooth animations
- **Fully Responsive** — Works on desktop, tablet, and mobile
- **Scroll Animations** — Reveal effects as you scroll
- **Accessible** — Semantic HTML, ARIA labels, keyboard-friendly navigation
- **Toast Notifications** — Non-intrusive feedback for all actions
- **FAQ Section** — Answers to common questions about privacy, adherence, and usage

---

## 🚀 Quick Start

### Option 1: Open Directly (Easiest)
1. Extract the `CareSync` folder
2. Open `index.html` in any modern web browser (Chrome, Edge, Firefox, Safari)
3. The app seeds with demo data automatically

### Option 2: Local Server (Recommended)
For the best experience (especially for notifications), serve it locally:

```bash
# Python 3
python -m http.server 8123 --bind 127.0.0.1

# Node.js (npx)
npx serve .

# PHP
php -S 127.0.0.1:8123
```

Then navigate to `http://127.0.0.1:8123/`

---

## 📁 Project Structure

```text
CareSync/
├── index.html   # Main HTML — all sections and structure
├── styles.css   # Design system, themes, responsive styles
└── app.js       # Core logic — state, rendering, interactions, AI companion
```

---

## 💾 Data & Privacy

- **100% Client-Side** — All data stays in your browser. Nothing is sent to any server.
- **localStorage Persistence** — Medications, logs, journal entries, caregivers, and chat history are saved locally.
- **You Control Sharing** — The "Share adherence data" toggle lets you pause caregiver sync at any time.
- **Easy Reset** — Clear your browser's localStorage for `caresync.v1` to re-seed demo data.
- **No Tracking** — No analytics, cookies, or third-party scripts beyond Google Fonts.

---

## 🛠️ Technical Details

| Component | Details |
|---|---|
| **Framework** | Vanilla JavaScript (ES6+) — no dependencies |
| **Styling** | CSS Custom Properties, Flexbox, Grid, animations |
| **Charts** | Custom Canvas API (no chart libraries) |
| **Icons** | Inline SVG icons |
| **Fonts** | Plus Jakarta Sans, Inter (Google Fonts) |
| **Storage Key** | `caresync.v1` in localStorage |

### Key Algorithms
- **Adherence Calculation** — Taken / (Taken + Skipped + Missed) × 100. Upcoming/due doses don't penalize the score
- **Grace Window** — 60 minutes after scheduled time before a dose counts as missed
- **Streak Tracking** — Consecutive perfect days (100% adherence) where doses were counted
- **Refill Prediction** — Days remaining = pills ÷ doses per day, with alerts at ≤20% or ≤3 days
- **Dose Status Priority** — Taken/Skipped (logged) → Due (within grace) → Missed (past grace) → Upcoming

---

## 🎮 Demo Walkthrough

On first load, CareSync seeds realistic demo data:

1. **4 Medications** — Metformin (500mg, twice daily), Lisinopril (10mg, morning), Atorvastatin (20mg, evening), Vitamin D3 (1000 IU, morning)
2. **13 Days of History** — Realistic 74–100% adherence with varied patterns
3. **Partial Today** — Some doses already taken
4. **2 Caregivers** — Anita Sharma (Daughter) and Dr. Meera Rao (Doctor)
5. **2 Journal Entries** — Sample side-effect and mood logs
6. **Chat Seeded** — Welcome message from the AI companion

Try these actions:
- Mark a dose as **Taken** or **Skip** from the Dashboard
- Add a new medication in the **Medications** section
- Talk to the **AI Companion** — ask "What's my next dose?"
- Link a caregiver in **Caregiver Sync**
- Log a symptom in the **Side-Effect Journal**
- Enable browser reminders on the Dashboard

---

## 🧪 Testing

The app was validated with a `jsdom` headless test suite covering:
- Initial render (dashboard, meds, caregivers, alerts, journal, chat)
- Dose logging with pill count decrement and undo
- Refill reset
- Form validation (invalid times rejected)
- Medication add/edit/delete
- Caregiver link/unlink
- Side-effect logging with severity escalation
- AI chat interaction
- Share toggle behavior

**Result:** 31/31 checks passed with zero runtime errors.

---

## 🌐 Live Demo

- **Editor + Preview:** [https://codesandbox.io/s/2d2nsy](https://codesandbox.io/s/2d2nsy)
- **Standalone Preview:** [https://2d2nsy.csb.app/](https://2d2nsy.csb.app/)

---

## 📄 License

This project is licensed under the **MIT License**. Feel free to use, modify, and distribute for personal or commercial purposes.

---

## 🤝 Contributing

This is a demo project, but suggestions are welcome! Feel free to:
- Report bugs or issues
- Suggest new features
- Improve accessibility
- Enhance the AI companion logic

---

**Made with 💚 for patients and caregivers who deserve better medication management.**
