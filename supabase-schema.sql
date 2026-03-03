-- =============================================
-- LEAFY CHAT APP - SUPABASE SCHEMA
-- by Sematech Developers
-- Run this in your Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- PROFILES TABLE
-- =============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  status text default 'Hey, I''m using Leafy!',
  online_status text default 'offline' check (online_status in ('online','away','busy','offline')),
  ghost_read boolean default false,
  vault_pin text,
  theme_preference text default 'dark',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================
-- CONVERSATIONS TABLE
-- =============================================
create table public.conversations (
  id uuid default uuid_generate_v4() primary key,
  type text not null check (type in ('dm', 'group')),
  name text,
  description text,
  avatar_url text,
  mood_color text default '#1a7a4a',
  mood_name text default 'default',
  is_vault boolean default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_message_at timestamptz default now()
);

-- =============================================
-- CONVERSATION MEMBERS TABLE
-- =============================================
create table public.conversation_members (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member' check (role in ('admin', 'member')),
  is_anonymous boolean default false,
  joined_at timestamptz default now(),
  last_read_at timestamptz default now(),
  unique(conversation_id, user_id)
);

-- =============================================
-- MESSAGES TABLE
-- =============================================
create table public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  content text,
  type text default 'text' check (type in ('text', 'image', 'video', 'audio', 'file', 'poll', 'payment', 'system')),
  metadata jsonb default '{}',
  is_anonymous boolean default false,
  reply_to uuid references public.messages(id),
  scheduled_at timestamptz,
  expires_at timestamptz,
  is_deleted boolean default false,
  edited_at timestamptz,
  created_at timestamptz default now()
);

-- =============================================
-- REACTIONS TABLE
-- =============================================
create table public.reactions (
  id uuid default uuid_generate_v4() primary key,
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

-- =============================================
-- POLLS TABLE
-- =============================================
create table public.polls (
  id uuid default uuid_generate_v4() primary key,
  message_id uuid references public.messages(id) on delete cascade unique,
  question text not null,
  options jsonb not null default '[]',
  votes jsonb not null default '{}',
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- =============================================
-- PINNED ITEMS TABLE (Context Cards)
-- =============================================
create table public.pinned_items (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  pinned_by uuid references public.profiles(id),
  title text not null,
  content text not null,
  color text default '#1a7a4a',
  created_at timestamptz default now()
);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;
alter table public.polls enable row level security;
alter table public.pinned_items enable row level security;

-- Profiles: anyone can read, only owner can update
create policy "Profiles are viewable by authenticated users" on public.profiles for select using (auth.role() = 'authenticated');
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Conversations: members can see
create policy "Members can view conversations" on public.conversations for select using (
  exists (select 1 from public.conversation_members where conversation_id = id and user_id = auth.uid())
);
create policy "Authenticated users can create conversations" on public.conversations for insert with check (auth.role() = 'authenticated');
create policy "Admins can update conversations" on public.conversations for update using (
  exists (select 1 from public.conversation_members where conversation_id = id and user_id = auth.uid() and role = 'admin')
);

-- Members
create policy "Members can view conversation members" on public.conversation_members for select using (
  exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = auth.uid())
);
create policy "Authenticated users can join conversations" on public.conversation_members for insert with check (auth.role() = 'authenticated');
create policy "Users can update their own membership" on public.conversation_members for update using (user_id = auth.uid());

-- Messages
create policy "Members can view messages" on public.messages for select using (
  exists (select 1 from public.conversation_members where conversation_id = messages.conversation_id and user_id = auth.uid())
);
create policy "Members can send messages" on public.messages for insert with check (
  auth.uid() = sender_id and
  exists (select 1 from public.conversation_members where conversation_id = messages.conversation_id and user_id = auth.uid())
);
create policy "Senders can update own messages" on public.messages for update using (auth.uid() = sender_id);

-- Reactions
create policy "Members can view reactions" on public.reactions for select using (auth.role() = 'authenticated');
create policy "Authenticated users can react" on public.reactions for insert with check (auth.uid() = user_id);
create policy "Users can delete own reactions" on public.reactions for delete using (auth.uid() = user_id);

-- Polls
create policy "Members can view polls" on public.polls for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage polls" on public.polls for all using (auth.role() = 'authenticated');

-- Pinned items
create policy "Members can view pinned items" on public.pinned_items for select using (auth.role() = 'authenticated');
create policy "Members can pin items" on public.pinned_items for insert with check (auth.role() = 'authenticated');
create policy "Pinners can delete their pins" on public.pinned_items for delete using (auth.uid() = pinned_by);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update conversation last_message_at
create or replace function public.update_conversation_timestamp()
returns trigger as $$
begin
  update public.conversations set last_message_at = now(), updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_message_sent
  after insert on public.messages
  for each row execute procedure public.update_conversation_timestamp();

-- =============================================
-- REALTIME
-- =============================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.profiles;
