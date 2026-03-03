# 🌿 LEAFY — Complete Supabase Setup Guide
## by Sematech Developers

Follow every step exactly to connect Leafy to your Supabase backend.

---

## STEP 1 — Create a Supabase Project

1. Go to **https://supabase.com** and sign up / log in
2. Click **"New Project"**
3. Fill in:
   - **Name:** `leafy` (or anything you like)
   - **Database Password:** choose a strong password and **save it**
   - **Region:** pick the closest to your users
4. Click **"Create new project"**
5. Wait ~2 minutes for the project to initialize

---

## STEP 2 — Run the Database Schema

1. In your Supabase dashboard, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Open the file `supabase-schema-v2-FULL.sql` from this project
4. **Copy the entire contents** and paste it into the SQL editor
5. Click **"Run"** (the green button, or press Ctrl+Enter)
6. You should see: `Success. No rows returned`
7. ✅ All tables, functions, triggers, and RLS policies are now created

---

## STEP 3 — Create Storage Buckets

1. In the left sidebar, click **"Storage"**
2. Click **"New bucket"** and create these 3 buckets:

   | Bucket Name | Public? |
   |-------------|---------|
   | `avatars`   | ✅ Yes  |
   | `media`     | ✅ Yes  |
   | `stories`   | ✅ Yes  |

3. For each bucket:
   - Click **"New bucket"**
   - Enter the name
   - Toggle **"Public bucket"** to ON
   - Click **"Create bucket"**

4. Add storage policies for each bucket:
   - Click the bucket → **"Policies"** tab → **"New Policy"** → **"For full customization"**
   - Policy for INSERT: `auth.role() = 'authenticated'`
   - Policy for SELECT: `true` (public read)

---

## STEP 4 — Get Your API Keys

1. In the left sidebar, click **"Settings"** (gear icon at the bottom)
2. Click **"API"**
3. You'll see two values you need:
   - **Project URL** — looks like `https://abcdefghijk.supabase.co`
   - **anon public key** — a long string starting with `eyJ...`

---

## STEP 5 — Configure Your App

1. In the Leafy project root folder, find the file `.env.example`
2. **Copy it** and rename the copy to `.env`
3. Open `.env` and fill in your values:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-full-key
```

Replace:
- `YOUR-PROJECT-ID` with your actual project ID
- The `eyJ...` value with your full anon key

---

## STEP 6 — Enable Email Auth

1. In Supabase dashboard → **"Authentication"** → **"Providers"**
2. Make sure **Email** is enabled (it is by default)
3. Under **"Email"**, you can toggle **"Confirm email"** OFF for easier development, or leave it ON for production

---

## STEP 7 — Configure Realtime

1. Go to **"Database"** → **"Replication"**
2. Scroll to the **"supabase_realtime"** publication
3. Make sure the following tables are enabled:
   - ✅ messages
   - ✅ reactions
   - ✅ conversations
   - ✅ conversation_members
   - ✅ profiles
   - ✅ stories
   - ✅ notifications
   - ✅ todo_items

(The schema SQL already does this — just verify here)

---

## STEP 8 — Run the App Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## STEP 9 — Deploy to Vercel

1. Push your code to a GitHub repository:
```bash
git init
git add .
git commit -m "Initial Leafy v2.0 commit"
git remote add origin https://github.com/YOUR_USERNAME/leafy.git
git push -u origin main
```

2. Go to **https://vercel.com** → **"New Project"**
3. Import your GitHub repository
4. Vercel auto-detects Vite ✅
5. Under **"Environment Variables"**, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
6. Click **"Deploy"**
7. Your app is live in ~60 seconds! 🎉

---

## STEP 10 — PWA Installation

- **Mobile (Android/iOS):** Open your Vercel URL in Chrome/Safari → tap Share → "Add to Home Screen"
- **Desktop (Chrome/Edge):** Click the install icon (⊕) in the address bar

---

## 🔧 Troubleshooting

**"Invalid API key" error:**
→ Double-check `.env` has no extra spaces or quotes around values

**Messages not appearing in realtime:**
→ Check Supabase → Database → Replication → supabase_realtime publication has messages table enabled

**File uploads failing:**
→ Check Storage buckets exist and are set to Public

**Auth not working:**
→ Check Authentication → Providers → Email is enabled

**RLS errors:**
→ Re-run `supabase-schema-v2-FULL.sql` to reset all policies

---

## Database Tables Created

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles, settings, preferences |
| `contacts` | Friends/contacts system |
| `conversations` | DMs, groups, communities |
| `conversation_members` | Who's in each conversation |
| `messages` | All chat messages |
| `reactions` | Emoji reactions on messages |
| `polls` | In-chat polls |
| `pinned_items` | Context pin cards |
| `message_edits` | Edit history for messages |
| `stories` | 24h status stories |
| `saved_messages` | Bookmarked messages |
| `notifications` | In-app notifications |
| `link_previews` | Cached link preview data |
| `todo_lists` | Shared to-do lists in chats |
| `todo_items` | Individual to-do items |
| `reminders` | Message reminders |
| `events` | Calendar events from chats |
| `voice_messages` | Voice message metadata |
| `user_shortcuts` | Custom keyboard shortcuts |

---

**Leafy v2.0** — Built by **Sematech Developers** 🌿
