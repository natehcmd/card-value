-- Card Value: one encrypted profile per signed-in user.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.
--
-- The app encrypts your saved numbers in the browser (AES-256-GCM) before they get here,
-- so this table only ever holds ciphertext. Row Level Security below means a signed-in
-- user can touch only their own row, and nobody who is signed out can touch any row.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  salt       text not null check (length(salt) between 16 and 64),
  iv         text not null check (length(iv) between 8 and 32),
  ciphertext text not null check (length(ciphertext) between 16 and 262144),
  version    smallint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

revoke all on public.profiles from public, anon;
grant select, insert, update, delete on public.profiles to authenticated;

drop policy if exists "own row: read"   on public.profiles;
drop policy if exists "own row: insert" on public.profiles;
drop policy if exists "own row: update" on public.profiles;
drop policy if exists "own row: delete" on public.profiles;

create policy "own row: read"   on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "own row: insert" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own row: update" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "own row: delete" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

-- Lets a signed-in user delete their own account and everything attached to it.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
