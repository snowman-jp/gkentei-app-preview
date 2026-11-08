-- G検定 クラウド同期検証用（本番未適用）
-- 新規の検証Supabaseプロジェクトだけで実行すること。
-- 利用許可は管理者がSQL Editor等で明示的に登録する。初期はゼロ人。
create table if not exists public.allowed_sync_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.allowed_sync_users enable row level security;
-- allowed_sync_users の公開RLS policyは作らない。クライアントから閲覧も変更も不可。

create table if not exists public.answer_events (
  event_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id text not null check (char_length(question_id) between 1 and 100),
  is_correct boolean not null,
  answered_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists answer_events_user_answered_idx
on public.answer_events (user_id, answered_at desc);
alter table public.answer_events enable row level security;

create policy "read own approved answer events"
on public.answer_events for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.allowed_sync_users a
    where a.user_id = (select auth.uid())
  )
);
create policy "insert own approved answer events"
on public.answer_events for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.allowed_sync_users a
    where a.user_id = (select auth.uid())
  )
);
-- UPDATE/DELETEポリシーは作らない（拒否）。
-- 初回本人ユーザーを許可する際は、本人UIDを安全に確認して管理者が追加。
-- insert into public.allowed_sync_users(user_id) values ('確認した本人のUID');
