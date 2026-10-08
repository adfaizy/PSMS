-- Store full discussion message fields (role, parentId, authorName, createdAt ms)
alter table public.discussion_messages
  add column if not exists meta jsonb not null default '{}'::jsonb;
