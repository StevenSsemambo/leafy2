-- ================================================================
-- LEAFY CHAT APP — COMPLETE SUPABASE SCHEMA v2
-- by Sematech Developers
-- Run the ENTIRE file in Supabase SQL Editor (Settings → SQL Editor)
-- ================================================================

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";  -- for fast text search

-- ================================================================
-- PROFILES
-- ================================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text,
  bio text,
  status text default 'Hey, I''m using Leafy!',
  online_status text default 'offline' check (online_status in ('online','away','busy','offline')),
  ghost_read boolean default false,
  vault_pin text,
  theme text default 'dark' check (theme in ('dark','light')),
  accent_color text default '#22c55e',
  density text default 'comfortable' check (density in ('comfortable','compact')),
  notification_sounds boolean default true,
  push_notifications boolean default true,
  onboarding_complete boolean default false,
  last_seen timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ================================================================
-- CONTACTS / FRIENDS
-- ================================================================
create table if not exists public.contacts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  contact_id uuid references public.profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz default now(),
  unique(user_id, contact_id)
);

-- ================================================================
-- CONVERSATIONS
-- ================================================================
create table if not exists public.conversations (
  id uuid default uuid_generate_v4() primary key,
  type text not null check (type in ('dm','group','community')),
  name text,
  description text,
  avatar_url text,
  mood_color text default '#1a7a4a',
  mood_name text default 'default',
  is_vault boolean default false,
  is_public boolean default false,          -- community groups
  invite_code text unique,                  -- group invite links
  invite_enabled boolean default false,
  admin_only_messages boolean default false,
  created_by uuid references public.profiles(id),
  last_message_at timestamptz default now(),
  last_message_preview text,
  member_count int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ================================================================
-- CONVERSATION MEMBERS
-- ================================================================
create table if not exists public.conversation_members (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member' check (role in ('owner','admin','member')),
  is_anonymous boolean default false,
  nickname text,
  muted_until timestamptz,
  last_read_at timestamptz default now(),
  joined_at timestamptz default now(),
  unique(conversation_id, user_id)
);

-- ================================================================
-- MESSAGES
-- ================================================================
create table if not exists public.messages (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  content text,
  type text default 'text' check (type in (
    'text','image','video','audio','file','poll','payment','system','voice','link_preview','todo'
  )),
  metadata jsonb default '{}',
  is_anonymous boolean default false,
  reply_to uuid references public.messages(id),
  thread_id uuid references public.messages(id),  -- for threaded replies
  thread_count int default 0,
  scheduled_at timestamptz,
  expires_at timestamptz,
  is_deleted boolean default false,
  is_forwarded boolean default false,
  is_saved boolean default false,
  edited_at timestamptz,
  forwarded_from uuid references public.conversations(id),
  mentioned_users uuid[] default '{}',
  search_vector tsvector generated always as (
    to_tsvector('english', coalesce(content, ''))
  ) stored,
  created_at timestamptz default now()
);

create index if not exists messages_search_idx on public.messages using gin(search_vector);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at desc);
create index if not exists messages_mentions_idx on public.messages using gin(mentioned_users);

-- ================================================================
-- REACTIONS
-- ================================================================
create table if not exists public.reactions (
  id uuid default uuid_generate_v4() primary key,
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

-- ================================================================
-- POLLS
-- ================================================================
create table if not exists public.polls (
  id uuid default uuid_generate_v4() primary key,
  message_id uuid references public.messages(id) on delete cascade unique,
  question text not null,
  options jsonb not null default '[]',
  votes jsonb not null default '{}',
  is_anonymous boolean default false,
  multiple_choice boolean default false,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- ================================================================
-- PINNED ITEMS (Context Cards)
-- ================================================================
create table if not exists public.pinned_items (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  pinned_by uuid references public.profiles(id),
  title text not null,
  content text not null,
  color text default '#1a7a4a',
  created_at timestamptz default now()
);

-- ================================================================
-- MESSAGE EDITS
-- ================================================================
create table if not exists public.message_edits (
  id uuid default uuid_generate_v4() primary key,
  message_id uuid references public.messages(id) on delete cascade,
  previous_content text not null,
  edited_by uuid references public.profiles(id),
  edited_at timestamptz default now()
);

-- ================================================================
-- STORIES
-- ================================================================
create table if not exists public.stories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  content text,
  media_url text,
  media_type text default 'text' check (media_type in ('text','image','video')),
  background_color text default '#1a7a4a',
  caption text,
  views jsonb default '[]',
  reactions jsonb default '{}',
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

-- ================================================================
-- SAVED MESSAGES
-- ================================================================
create table if not exists public.saved_messages (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  note text,
  created_at timestamptz default now(),
  unique(user_id, message_id)
);

-- ================================================================
-- NOTIFICATIONS
-- ================================================================
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'mention','reaction','message','friend_request','friend_accepted',
    'group_invite','story_view','system'
  )),
  title text not null,
  body text,
  data jsonb default '{}',
  is_read boolean default false,
  actor_id uuid references public.profiles(id),
  conversation_id uuid references public.conversations(id),
  message_id uuid references public.messages(id),
  created_at timestamptz default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, is_read, created_at desc);

-- ================================================================
-- LINK PREVIEWS CACHE
-- ================================================================
create table if not exists public.link_previews (
  id uuid default uuid_generate_v4() primary key,
  url text unique not null,
  title text,
  description text,
  image_url text,
  site_name text,
  fetched_at timestamptz default now()
);

-- ================================================================
-- TODO LISTS (inside chats)
-- ================================================================
create table if not exists public.todo_lists (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  title text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

create table if not exists public.todo_items (
  id uuid default uuid_generate_v4() primary key,
  list_id uuid references public.todo_lists(id) on delete cascade,
  text text not null,
  completed boolean default false,
  assigned_to uuid references public.profiles(id),
  due_date date,
  created_by uuid references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz default now()
);

-- ================================================================
-- REMINDERS
-- ================================================================
create table if not exists public.reminders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  remind_at timestamptz not null,
  note text,
  is_sent boolean default false,
  created_at timestamptz default now()
);

-- ================================================================
-- EVENTS (from chats)
-- ================================================================
create table if not exists public.events (
  id uuid default uuid_generate_v4() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade,
  created_by uuid references public.profiles(id),
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  rsvps jsonb default '{}',   -- {user_id: 'yes'|'no'|'maybe'}
  created_at timestamptz default now()
);

-- ================================================================
-- VOICE MESSAGES (metadata)
-- ================================================================
create table if not exists public.voice_messages (
  id uuid default uuid_generate_v4() primary key,
  message_id uuid references public.messages(id) on delete cascade unique,
  duration_seconds int not null,
  waveform jsonb default '[]',  -- array of amplitude values for visualisation
  url text not null,
  created_at timestamptz default now()
);

-- ================================================================
-- KEYBOARD SHORTCUTS
-- ================================================================
create table if not exists public.user_shortcuts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  shortcut text not null,
  action text not null,
  created_at timestamptz default now(),
  unique(user_id, shortcut)
);

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;
alter table public.polls enable row level security;
alter table public.pinned_items enable row level security;
alter table public.message_edits enable row level security;
alter table public.stories enable row level security;
alter table public.saved_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.link_previews enable row level security;
alter table public.todo_lists enable row level security;
alter table public.todo_items enable row level security;
alter table public.reminders enable row level security;
alter table public.events enable row level security;
alter table public.voice_messages enable row level security;
alter table public.user_shortcuts enable row level security;

-- Profiles
create policy "profiles_select" on public.profiles for select using (auth.role() = 'authenticated');
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Contacts
create policy "contacts_select" on public.contacts for select using (auth.uid() = user_id or auth.uid() = contact_id);
create policy "contacts_insert" on public.contacts for insert with check (auth.uid() = user_id);
create policy "contacts_update" on public.contacts for update using (auth.uid() = user_id or auth.uid() = contact_id);
create policy "contacts_delete" on public.contacts for delete using (auth.uid() = user_id);

-- Conversations
create policy "conversations_select" on public.conversations for select using (
  is_public = true or
  exists (select 1 from public.conversation_members where conversation_id = id and user_id = auth.uid())
);
create policy "conversations_insert" on public.conversations for insert with check (auth.role() = 'authenticated');
create policy "conversations_update" on public.conversations for update using (
  exists (select 1 from public.conversation_members where conversation_id = id and user_id = auth.uid() and role in ('owner','admin'))
);

-- Members
create policy "members_select" on public.conversation_members for select using (
  exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = auth.uid())
  or exists (select 1 from public.conversations c where c.id = conversation_id and c.is_public = true)
);
create policy "members_insert" on public.conversation_members for insert with check (auth.role() = 'authenticated');
create policy "members_update" on public.conversation_members for update using (user_id = auth.uid());
create policy "members_delete" on public.conversation_members for delete using (
  user_id = auth.uid() or
  exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = auth.uid() and cm.role in ('owner','admin'))
);

-- Messages
create policy "messages_select" on public.messages for select using (
  exists (select 1 from public.conversation_members where conversation_id = messages.conversation_id and user_id = auth.uid())
);
create policy "messages_insert" on public.messages for insert with check (
  auth.uid() = sender_id and
  exists (select 1 from public.conversation_members where conversation_id = messages.conversation_id and user_id = auth.uid())
);
create policy "messages_update" on public.messages for update using (auth.uid() = sender_id);

-- Reactions
create policy "reactions_select" on public.reactions for select using (auth.role() = 'authenticated');
create policy "reactions_insert" on public.reactions for insert with check (auth.uid() = user_id);
create policy "reactions_delete" on public.reactions for delete using (auth.uid() = user_id);

-- Polls
create policy "polls_all" on public.polls for all using (auth.role() = 'authenticated');

-- Pinned items
create policy "pins_select" on public.pinned_items for select using (auth.role() = 'authenticated');
create policy "pins_insert" on public.pinned_items for insert with check (auth.role() = 'authenticated');
create policy "pins_delete" on public.pinned_items for delete using (auth.uid() = pinned_by);

-- Message edits
create policy "edits_select" on public.message_edits for select using (auth.role() = 'authenticated');
create policy "edits_insert" on public.message_edits for insert with check (auth.uid() = edited_by);

-- Stories
create policy "stories_select" on public.stories for select using (auth.role() = 'authenticated' and expires_at > now());
create policy "stories_insert" on public.stories for insert with check (auth.uid() = user_id);
create policy "stories_update" on public.stories for update using (auth.uid() = user_id);
create policy "stories_delete" on public.stories for delete using (auth.uid() = user_id);

-- Saved messages
create policy "saved_select" on public.saved_messages for select using (auth.uid() = user_id);
create policy "saved_insert" on public.saved_messages for insert with check (auth.uid() = user_id);
create policy "saved_delete" on public.saved_messages for delete using (auth.uid() = user_id);

-- Notifications
create policy "notif_select" on public.notifications for select using (auth.uid() = user_id);
create policy "notif_update" on public.notifications for update using (auth.uid() = user_id);
create policy "notif_insert" on public.notifications for insert with check (auth.role() = 'authenticated');

-- Link previews (public cache)
create policy "link_preview_all" on public.link_previews for all using (auth.role() = 'authenticated');

-- Todo lists
create policy "todo_lists_select" on public.todo_lists for select using (
  exists (select 1 from public.conversation_members where conversation_id = todo_lists.conversation_id and user_id = auth.uid())
);
create policy "todo_lists_insert" on public.todo_lists for insert with check (auth.role() = 'authenticated');
create policy "todo_lists_delete" on public.todo_lists for delete using (auth.uid() = created_by);

-- Todo items
create policy "todo_items_select" on public.todo_items for select using (auth.role() = 'authenticated');
create policy "todo_items_all" on public.todo_items for all using (auth.role() = 'authenticated');

-- Reminders
create policy "reminders_all" on public.reminders for all using (auth.uid() = user_id);

-- Events
create policy "events_select" on public.events for select using (
  exists (select 1 from public.conversation_members where conversation_id = events.conversation_id and user_id = auth.uid())
);
create policy "events_insert" on public.events for insert with check (auth.role() = 'authenticated');
create policy "events_update" on public.events for update using (auth.uid() = created_by);

-- Voice messages
create policy "voice_select" on public.voice_messages for select using (auth.role() = 'authenticated');
create policy "voice_insert" on public.voice_messages for insert with check (auth.role() = 'authenticated');

-- User shortcuts
create policy "shortcuts_all" on public.user_shortcuts for all using (auth.uid() = user_id);

-- ================================================================
-- FUNCTIONS
-- ================================================================

-- Auto create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Update conversation last_message_at and preview
create or replace function public.update_conversation_on_message()
returns trigger as $$
begin
  update public.conversations set
    last_message_at = new.created_at,
    last_message_preview = case
      when new.type = 'text' then left(new.content, 80)
      when new.type = 'image' then '📷 Photo'
      when new.type = 'video' then '🎬 Video'
      when new.type = 'voice' then '🎤 Voice message'
      when new.type = 'file' then '📎 File'
      when new.type = 'poll' then '📊 Poll'
      when new.type = 'audio' then '🎵 Audio'
      else new.content
    end,
    updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_message_sent on public.messages;
create trigger on_message_sent
  after insert on public.messages
  for each row execute procedure public.update_conversation_on_message();

-- Update member count
create or replace function public.update_member_count()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    update public.conversations set member_count = member_count + 1 where id = new.conversation_id;
  elsif tg_op = 'DELETE' then
    update public.conversations set member_count = greatest(member_count - 1, 0) where id = old.conversation_id;
  end if;
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists on_member_change on public.conversation_members;
create trigger on_member_change
  after insert or delete on public.conversation_members
  for each row execute procedure public.update_member_count();

-- Create notification on mention
create or replace function public.handle_mention_notification()
returns trigger as $$
declare
  uid uuid;
  sender_name text;
begin
  if new.mentioned_users is null or array_length(new.mentioned_users, 1) = 0 then
    return new;
  end if;
  select display_name into sender_name from public.profiles where id = new.sender_id;
  foreach uid in array new.mentioned_users loop
    if uid != new.sender_id then
      insert into public.notifications (user_id, type, title, body, actor_id, conversation_id, message_id, data)
      values (
        uid, 'mention',
        sender_name || ' mentioned you',
        left(new.content, 100),
        new.sender_id, new.conversation_id, new.id,
        jsonb_build_object('conversation_id', new.conversation_id, 'message_id', new.id)
      );
    end if;
  end loop;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_mention on public.messages;
create trigger on_mention
  after insert on public.messages
  for each row execute procedure public.handle_mention_notification();

-- Full text search function
create or replace function public.search_messages(
  p_user_id uuid,
  p_query text,
  p_conversation_id uuid default null
)
returns table(
  id uuid, conversation_id uuid, sender_id uuid, content text,
  type text, created_at timestamptz, display_name text, username text
)
language sql security definer as $$
  select m.id, m.conversation_id, m.sender_id, m.content,
    m.type, m.created_at, p.display_name, p.username
  from public.messages m
  join public.profiles p on p.id = m.sender_id
  where
    m.is_deleted = false
    and m.search_vector @@ plainto_tsquery('english', p_query)
    and (p_conversation_id is null or m.conversation_id = p_conversation_id)
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = m.conversation_id and cm.user_id = p_user_id
    )
  order by ts_rank(m.search_vector, plainto_tsquery('english', p_query)) desc, m.created_at desc
  limit 50;
$$;

-- Get or create DM function
create or replace function public.get_or_create_dm(user1 uuid, user2 uuid)
returns uuid language plpgsql security definer as $$
declare
  conv_id uuid;
begin
  select c.id into conv_id
  from public.conversations c
  where c.type = 'dm'
    and exists (select 1 from public.conversation_members where conversation_id = c.id and user_id = user1)
    and exists (select 1 from public.conversation_members where conversation_id = c.id and user_id = user2)
    and (select count(*) from public.conversation_members where conversation_id = c.id) = 2
  limit 1;
  return conv_id;
end;
$$;

-- Join community by invite code
create or replace function public.join_by_invite(p_invite_code text, p_user_id uuid)
returns uuid language plpgsql security definer as $$
declare
  conv_id uuid;
begin
  select id into conv_id from public.conversations
  where invite_code = p_invite_code and invite_enabled = true;
  if conv_id is null then return null; end if;
  insert into public.conversation_members (conversation_id, user_id, role)
  values (conv_id, p_user_id, 'member')
  on conflict (conversation_id, user_id) do nothing;
  return conv_id;
end;
$$;

-- ================================================================
-- REALTIME
-- ================================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.conversation_members;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.stories;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.todo_items;

-- ================================================================
-- STORAGE BUCKETS (run separately or via Supabase dashboard)
-- Create these buckets in Storage → New Bucket:
--   - avatars  (public: true)
--   - media    (public: true)   ← images, videos, files, voice
--   - stories  (public: true)
-- ================================================================
