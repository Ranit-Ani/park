# 🅿️ Smart Car Parking Management System

A full-stack Smart Car Parking Management System designed to manage parking slots across multiple locations with Admin, Staff, and User roles. Features include slot management, booking, vehicle management, location-based parking, and revenue tracking.

---

## 🚀 Live Demo

**URL:** *https://car-parking-app-xofv.onrender.com*


---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router, Vite, Bootstrap 5 (icons/utility classes, via CDN), Three.js (via CDN, desktop only), Chart.js |
| Mobile App | Capacitor (Android) — same React codebase, packaged as a native app (`frontend/android`) |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas |
| Auth | JWT + OTP Email Verification |
| AI Assistant | Self-hosted TF-IDF + Logistic Regression intent classifier (Python/Flask) — no external LLM API key needed. See `ai/README.md` |
| Email | Brevo transactional email API (OTP emails) + EmailJS (Landing page Contact Us form) |
| Hosting | Render (single Web Service) |

> **Architecture note:** This project is deployed as **one single Render Web Service** — the Express backend serves the built React frontend directly from `frontend/dist`, so there's no separate static site or second service to manage. One repo, one service, one URL.

> **Frontend note:** The UI is a structured React app (`frontend/`), built with Vite into `frontend/dist` and served directly by the Express backend in production — see the Local Setup section below for exact build/dev commands.

---

## ⚙️ Local Setup

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

### 2. Install dependencies
```bash
cd backend && npm install
```

### 3. Create your .env file
```bash
cp backend/.env.example backend/.env
# Fill in your values
```

### 4. Run locally
```bash
cd backend && npm run dev
```

Open: **http://localhost:5000** (matches `PORT=5000` in `.env.example` — the code itself falls back to `6000` if `PORT` is unset)

> **AI Assistant note:** `npm run dev` also spawns the Python AI chat service automatically (`backend/utils/aiProcess.js` → `ai/api/app.py`). For that to work locally you first need to train the model once — see `ai/README.md` for the `pip install` / `build_dataset.py` / `train.py` steps. If you don't need the chat assistant while developing, set `SKIP_AI_PROCESS=true` in `backend/.env` to skip spawning it entirely (the rest of the app works fine without it).

> **Frontend:** the backend only serves the frontend from `frontend/dist`, which isn't built yet on a fresh clone. Build it once with `cd frontend && npm install && npm run build`, or for local development with hot reload, run `cd frontend && npm run dev` in a second terminal (proxies `/api` to `http://localhost:5000`) instead of visiting the backend's own port directly.

---

## 🌐 Deployment Guide

See step-by-step instructions below in this README.

### STEP 1 — MongoDB Atlas

1. Go to **cloud.mongodb.com** → Sign up free
2. Build a Database → **M0 Free tier**
3. Create a DB user with username + password
4. Network Access → Add IP → `0.0.0.0/0` (allow all)
5. Connect → Drivers → copy your connection string

### STEP 2 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

### STEP 3 — Brevo (Email Setup)

This app sends OTP emails via **Brevo's transactional email API** (the `sib-api-v3-sdk` package), not raw SMTP — so all you need is an API key, not SMTP credentials.

1. Go to **brevo.com** → Sign up free
2. Go to **SMTP & API → API Keys** (under Senders & IP, or Settings) → generate an **API Key** and save it — this is your `BREVO_API_KEY`
3. Verify a sender email/domain under **Senders → Domains** so your "from" address isn't flagged as spam — this verified address is your `EMAIL_USER`

### STEP 4 — Deploy on Render

1. Go to **render.com** → Sign up with GitHub
2. **New +** → **Web Service** → connect your GitHub repo
3. Configure the service:

| Setting | Value |
|---------|-------|
| Name | campus-parking (or any name) |
| Region | closest to you |
| Branch | main |
| Root Directory | *(leave blank — repo root)* |
| Build Command | `cd frontend && npm install --include=dev && npm run build && cd ../backend && npm install && cd ../ai && pip install --upgrade pip --break-system-packages && pip install --break-system-packages -r requirements.txt && python3 dataset/build_dataset.py && python3 training/train.py` |
| Start Command | `node backend/server.js` |
| Instance Type | Free (or paid, as needed) |

4. Go to **Environment** tab → add these variables:

| Variable | Required? | Value |
|----------|-----------|-------|
| NODE_ENV | Yes | production |
| MONGO_URI | Yes | your Atlas connection string |
| JWT_SECRET | Yes | any long random string |
| JWT_EXPIRE | No (defaults to `7d`) | 7d |
| BREVO_API_KEY | Yes — OTP emails won't send without it | your Brevo **API key** (Account → SMTP & API → API Keys — this app calls Brevo's transactional email API directly, not raw SMTP) |
| EMAIL_USER | Yes | the sender/reply-to address OTP emails are sent from (must be a verified sender in Brevo) |
| OTP_EXPIRE_MINUTES | No (defaults to `10`) | 10 |
| CORS_ORIGIN | Yes | comma-separated list of allowed origins. Include your Render URL, **plus** the Android app's WebView origins so the Capacitor APK isn't blocked: `https://your-app.onrender.com,capacitor://localhost,https://localhost` |
| PORT | No (Render sets this itself) | — |
| AI_API_URL | No (defaults to `http://127.0.0.1:5001`) | only change if the Python AI service runs on a different host/port |
| AI_API_PORT | No (defaults to `5001`) | port the Node backend spawns the Python AI service on |
| PYTHON_BIN | No (defaults to `python3`) | override if your environment's Python binary is named differently |
| SKIP_AI_PROCESS | No | set to `true` to disable the AI chat assistant entirely (skips spawning the Python process) |
| ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD | No | only used by the `npm run seed` script (see **Roles** below) to create the very first admin account — defaults exist if unset |
| EMAILJS_SERVICE_ID / EMAILJS_TEMPLATE_ID / EMAILJS_PUBLIC_KEY / EMAILJS_PRIVATE_KEY / SUPPORT_EMAIL | No | powers the Landing page's "Contact Us" form (backend proxies to EmailJS). If left unset, the form disables itself gracefully and tells visitors to use "Email Support" instead |

> Every variable and its exact meaning is also documented, in more detail, in `backend/.env.example`.

5. Click **Create Web Service** → Render will build and deploy automatically
6. Wait for the build to finish (2–5 min) → your live URL will appear at the top of the service page, in the format `https://your-app.onrender.com`
7. Update `CORS_ORIGIN` env variable with this final URL once you have it, then **Manual Deploy → Clear build cache & deploy** if needed

> **Note:** Render's free tier spins down after inactivity, so the first request after idle time may take 30–60 seconds to respond.

---

## 👤 Roles

| Role | Access |
|------|--------|
| user | Book slots, manage profile |
| staff | Check-in / check-out |
| admin | Full control |

To make yourself admin, either:
- **Manually:** MongoDB Atlas → Browse Collections → `users` → set `role` to `"admin"` on your account, or
- **Via the seed script:** `cd backend && npm run seed` creates a fresh admin account using the `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars (sensible defaults are used for any left unset — see `backend/utils/seeder.js`)

---

## 📱 Android App (Capacitor)

The same React frontend is also packaged as a native Android app via [Capacitor](https://capacitorjs.com) — see `frontend/capacitor.config.json` and the generated `frontend/android` project.

Two things that only apply to the Android build (not the normal web build):
- Because the app loads from `capacitor://localhost` (no backend at that origin), you must set `VITE_API_BASE_URL` to your deployed backend's absolute URL when building the frontend for Android — see `frontend/.env.example`. Leave it unset for the normal web build, where a relative `/api` path is correct (backend + frontend are served from the same Render origin).
- Add the Capacitor origins (`capacitor://localhost`, `https://localhost`) to the backend's `CORS_ORIGIN`, as shown in the env var table above — otherwise the app's API/login/socket calls are blocked by CORS.