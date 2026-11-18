-- Run this in Supabase > SQL Editor.
-- User profile table (optional, for member profiles)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Activity history stores metadata only, never the PDF file itself.
create table if not exists public.pdf_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  tool text not null check (tool in ('merge','split','rotate','compress')),
  file_count integer not null default 1 check (file_count > 0),
  output_name text,
  created_at timestamptz not null default now()
);

alter table public.pdf_history enable row level security;

drop policy if exists "Users can read own PDF history" on public.pdf_history;
create policy "Users can read own PDF history"
on public.pdf_history for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own PDF history" on public.pdf_history;
create policy "Users can insert own PDF history"
on public.pdf_history for insert to authenticated
with check ((select auth.uid()) = user_id);

-- No public update/delete policy is provided.
