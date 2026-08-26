# 🅿️ AG Parking — Smart Campus Car Parking System

A full-stack campus parking management system with real-time slot booking, staff operations, admin dashboard, OTP email verification, and an anti-gravity spider web cursor UI.

---

## 🚀 Live Demo

**URL:** *https://car-parking-app-xofv.onrender.com*


---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, React Router, Vite, Bootstrap 5 (icons/utility classes), Three.js, Chart.js |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas |
| Auth | JWT + OTP Email Verification |
| Email | Brevo (SMTP relay + API) |
| Hosting | Render (single Web Service) |

> **Architecture note:** This project is deployed as **one single Render Web Service** — the Express backend serves the built React frontend directly from `frontend/dist`, so there's no separate static site or second service to manage. One repo, one service, one URL.

> **Frontend note:** The UI was migrated from static HTML/vanilla JS to a structured React app (`frontend/`). All backend logic and API contracts are unchanged. The backend serves the production build from `frontend/dist` — run `cd frontend && npm install && npm run build` any time you change frontend source. For local frontend development with hot reload, run `cd frontend && npm run dev` (proxies `/api` to `http://localhost:5000`) alongside the backend.

---

## ⚙️ Local Setup

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/campus-parking.git
cd campus-parking
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

Open: **http://localhost:5000**

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

1. Go to **brevo.com** → Sign up free
2. Go to **SMTP & API** (under Senders & IP, or Settings)
3. Copy your **SMTP credentials**:
   - SMTP Server: `smtp-relay.brevo.com`
   - Port: `587`
   - Login: your Brevo account email
   - SMTP Key/Password: generate one under **SMTP & API → SMTP** tab
4. (Optional, if using Brevo's transactional email API instead of SMTP) Go to **SMTP & API → API Keys** → generate an **API Key** and save it
5. Verify a sender email/domain under **Senders → Domains** so your "from" address isn't flagged as spam

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

| Variable | Value |
|----------|-------|
| NODE_ENV | production |
| MONGO_URI | your Atlas connection string |
| JWT_SECRET | any long random string |
| JWT_EXPIRE | 7d |
| EMAIL_HOST | smtp-relay.brevo.com |
| EMAIL_PORT | 587 |
| EMAIL_USER | your Brevo SMTP login |
| EMAIL_PASS | your Brevo SMTP key |
| BREVO_API_KEY | your Brevo API key *(if using API instead of/alongside SMTP)* |
| EMAIL_FROM | Campus Parking <your-verified-sender@yourdomain.com> |
| OTP_EXPIRE_MINUTES | 10 |
| CORS_ORIGIN | https://your-app.onrender.com |

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

To make yourself admin: MongoDB Atlas → Browse Collections → users → set `role` to `"admin"`
