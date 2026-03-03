-- =============================================
-- LEAFY v1.1 - SCHEMA ADDITIONS
-- Run this in Supabase SQL Editor (after v1.0 schema)
-- Features: File Sharing, Message Editing, Stories, Search
-- =============================================

-- =============================================
-- 1. FILE SHARING - extend messages metadata
--    (messages table already supports type='file', just add storage bucket)
--    No schema changes needed — metadata jsonb handles file info.
--    Just create 'media' bucket in Supabase Storage (public).
-- =============================================

-- =============================================
-- 2. MESSAGE EDITING - already have edited_at column
--    Add edit history table for audit trail
-- =============================================
create table if not exists public.message_edits (
  id uuid default uuid_generate_v4() primary key,
  message_id uuid references public.messages(id) on delete cascade,
  previous_content text not null,
  edited_by uuid references public.profiles(id),
  edited_at timestamptz default now()
);

alter table public.message_edits enable row level security;

create policy "Members can view edit history" on public.message_edits
  for select using (auth.role() = 'authenticated');

create policy "Editors can insert edit history" on public.message_edits
  for insert with check (auth.uid() = edited_by);

-- =============================================
-- 3. STORIES / STATUS UPDATES
-- =============================================
create table if not exists public.stories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  content text,
  media_url text,
  media_type text default 'text' check (media_type in ('text', 'image', 'video')),
  background_color text default '#1a7a4a',
  caption text,
  views jsonb default '[]',   -- array of user_ids who viewed
  expires_at timestamptz default (now() + interval '24 hours'),
  created_at timestamptz default now()
);

alter table public.stories enable row level security;

create policy "Authenticated users can view stories" on public.stories
  for select using (
    auth.role() = 'authenticated'
    and expires_at > now()
  );

create policy "Users can create own stories" on public.stories
  for insert with check (auth.uid() = user_id);

create policy "Users can update own stories" on public.stories
  for update using (auth.uid() = user_id);

create policy "Users can delete own stories" on public.stories
  for delete using (auth.uid() = user_id);

-- Add stories to realtime
alter publication supabase_realtime add table public.stories;
alter publication supabase_realtime add table public.message_edits;

-- =============================================
-- 4. FULL-TEXT SEARCH
--    Add tsvector column for efficient search
-- =============================================
alter table public.messages add column if not exists search_vector tsvector
  generated always as (to_tsvector('english', coalesce(content, ''))) stored;

create index if not exists messages_search_idx on public.messages using gin(search_vector);

-- Search function
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
  select
    m.id, m.conversation_id, m.sender_id, m.content,
    m.type, m.created_at, p.display_name, p.username
  from public.messages m
  join public.profiles p on p.id = m.sender_id
  where
    m.is_deleted = false
    and m.search_vector @@ plainto_tsquery('english', p_query)
    and (p_conversation_id is null or m.conversation_id = p_conversation_id)
    and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = m.conversation_id
      and cm.user_id = p_user_id
    )
  order by m.created_at desc
  limit 50;
$$;
