# 🌿 LEAFY Chat App
### by Sematech Developers

A next-generation, full-featured PWA chat application with real-time messaging, privacy features, and beautiful UI.

---

## ✨ Features

- 💬 **Real-time messaging** — instant DMs and group chats via Supabase Realtime
- 👻 **Ghost Read** — read messages without triggering read receipts
- 🔥 **Self-Destructing Messages** — messages auto-expire after set time
- ⏰ **Message Scheduling** — send messages at a future date/time
- 🕵️ **Anonymous Mode** — send messages anonymously in any chat
- 📊 **In-Chat Polls** — create and vote on polls directly in conversations
- 📌 **Context Pins** — pin important info cards to any conversation
- 🎨 **Chat Moods** — set color themes per conversation (7 moods)
- 🔐 **Vault Chats** — PIN-protected private conversations
- 💬 **Message Reactions** — quick emoji reactions on any message
- ↩️ **Reply Threading** — reply to specific messages
- 👥 **Group Chats** — create groups with multiple members
- 🟢 **Presence** — real-time online/away/busy/offline status
- 📱 **PWA** — installable on mobile and desktop

---

## 🚀 Setup

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/leafy.git
cd leafy
npm install
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** and run the entire contents of `supabase-schema.sql`
3. Go to **Storage** → Create buckets:
   - `avatars` (public)
   - `media` (public)
4. Copy your **Project URL** and **anon key** from **Settings → API**

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## 📦 Deploy to Vercel

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy! Vercel auto-detects Vite.

---

## 🗂️ Project Structure

```
leafy/
├── public/
│   └── favicon.svg
├── src/
│   ├── components/
│   │   ├── Avatar.jsx
│   │   ├── ChatArea.jsx
│   │   ├── MessageBubble.jsx
│   │   ├── SettingsModal.jsx
│   │   ├── SidePanel.jsx
│   │   └── Sidebar.jsx
│   ├── lib/
│   │   ├── store.js        # Zustand global state
│   │   └── supabase.js     # Supabase client & helpers
│   ├── pages/
│   │   └── AuthPage.jsx
│   ├── styles/
│   │   └── main.css
│   ├── App.jsx
│   └── main.jsx
├── supabase-schema.sql      # Run this in Supabase SQL Editor
├── vercel.json
├── vite.config.js
└── package.json
```

---

## 🔧 Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + Vite |
| State | Zustand |
| Database | Supabase (PostgreSQL) |
| Realtime | Supabase Realtime |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| PWA | vite-plugin-pwa + Workbox |
| Styling | Pure CSS (no framework) |
| Deployment | Vercel |

---

## 📱 PWA Installation

On mobile: tap **Share → Add to Home Screen**
On desktop: click the install icon in your browser's address bar

---

## 🛠️ Future Roadmap

- [ ] AI-powered message summaries
- [ ] Voice/video calls (WebRTC)
- [ ] End-to-end encryption
- [ ] Payment integration (Stripe)
- [ ] Message search
- [ ] File sharing

---

**Leafy v1.0.0** — Built with 💚 by **Sematech Developers**
