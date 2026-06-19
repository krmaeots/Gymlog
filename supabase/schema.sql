-- GymLog cloud backend (Supabase) — PIN-gated synced datastore.
--
-- Paste this whole file into the Supabase SQL editor and run it. It is
-- idempotent (safe to re-run). Then create the first admin once:
--
--     select gym_bootstrap_admin('Kristjan', '1234');
--
-- Design: NO Supabase Auth. Each person is a row in `profiles` holding their
-- full GymState as jsonb, guarded by a PIN. Row-Level Security blocks ALL
-- direct table access from the public anon key; every read/write goes through
-- the SECURITY DEFINER functions below, which verify the PIN server-side with
-- bcrypt (pgcrypto). So the anon key can never bulk-read PIN hashes or other
-- users' data — it can only call these functions.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.profiles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  pin_hash   text not null,
  is_admin   boolean not null default false,
  state      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Lock the table: RLS on, and revoke direct access. With no policies, the anon
-- and authenticated roles cannot select/insert/update/delete rows directly.
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;

-- ── internal helper: resolve an admin by PIN (not exposed to clients) ────────
create or replace function public._gym_admin_id(p_admin_pin text)
returns uuid
language sql
security definer
set search_path = public, extensions
as $$
  select id from public.profiles
  where is_admin and pin_hash = crypt(p_admin_pin, pin_hash)
  limit 1;
$$;
revoke all on function public._gym_admin_id(text) from anon, authenticated, public;

-- ── public picker: names only, never hashes or state ─────────────────────────
create or replace function public.gym_list_profiles()
returns table(id uuid, name text, is_admin boolean)
language sql
security definer
set search_path = public
as $$
  select id, name, is_admin from public.profiles order by name;
$$;

-- ── login: verify PIN, return the profile + its state ────────────────────────
create or replace function public.gym_login(p_name text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r public.profiles;
begin
  select * into r from public.profiles where name = p_name;
  if not found or r.pin_hash <> crypt(p_pin, r.pin_hash) then
    raise exception 'invalid_credentials' using errcode = '28P01';
  end if;
  return jsonb_build_object(
    'id', r.id, 'name', r.name, 'is_admin', r.is_admin,
    'state', r.state, 'updated_at', r.updated_at
  );
end;
$$;

-- ── pull/push own state (PIN required each call) ─────────────────────────────
create or replace function public.gym_pull(p_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r public.profiles;
begin
  select * into r from public.profiles where id = p_id;
  if not found or r.pin_hash <> crypt(p_pin, r.pin_hash) then
    raise exception 'invalid_credentials' using errcode = '28P01';
  end if;
  return jsonb_build_object('state', r.state, 'updated_at', r.updated_at);
end;
$$;

create or replace function public.gym_push(p_id uuid, p_pin text, p_state jsonb)
returns timestamptz
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r public.profiles; ts timestamptz;
begin
  select * into r from public.profiles where id = p_id;
  if not found or r.pin_hash <> crypt(p_pin, r.pin_hash) then
    raise exception 'invalid_credentials' using errcode = '28P01';
  end if;
  update public.profiles set state = p_state, updated_at = now()
    where id = p_id returning updated_at into ts;
  return ts;
end;
$$;

-- ── first-admin bootstrap (self-disables once any admin exists) ──────────────
create or replace function public.gym_bootstrap_admin(p_name text, p_pin text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare new_id uuid;
begin
  if exists (select 1 from public.profiles where is_admin) then
    raise exception 'admin_already_exists';
  end if;
  insert into public.profiles(name, pin_hash, is_admin)
    values (p_name, crypt(p_pin, gen_salt('bf')), true)
    returning id into new_id;
  return new_id;
end;
$$;

-- ── admin operations (require a valid admin PIN) ─────────────────────────────
create or replace function public.gym_admin_list(p_admin_pin text)
returns table(id uuid, name text, is_admin boolean, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if public._gym_admin_id(p_admin_pin) is null then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query select p.id, p.name, p.is_admin, p.updated_at
    from public.profiles p order by p.name;
end;
$$;

create or replace function public.gym_admin_create(
  p_admin_pin text, p_name text, p_pin text, p_is_admin boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare new_id uuid;
begin
  if public._gym_admin_id(p_admin_pin) is null then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  insert into public.profiles(name, pin_hash, is_admin)
    values (p_name, crypt(p_pin, gen_salt('bf')), coalesce(p_is_admin, false))
    returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.gym_admin_reset_pin(
  p_admin_pin text, p_target_id uuid, p_new_pin text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if public._gym_admin_id(p_admin_pin) is null then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  update public.profiles set pin_hash = crypt(p_new_pin, gen_salt('bf'))
    where id = p_target_id;
end;
$$;

create or replace function public.gym_admin_delete(p_admin_pin text, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if public._gym_admin_id(p_admin_pin) is null then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  -- never remove the last admin
  if (select is_admin from public.profiles where id = p_target_id)
     and (select count(*) from public.profiles where is_admin) <= 1 then
    raise exception 'cannot_delete_last_admin';
  end if;
  delete from public.profiles where id = p_target_id;
end;
$$;

create or replace function public.gym_admin_pull(p_admin_pin text, p_target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r public.profiles;
begin
  if public._gym_admin_id(p_admin_pin) is null then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  select * into r from public.profiles where id = p_target_id;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('state', r.state, 'updated_at', r.updated_at);
end;
$$;

-- Admin edits only the plan: merge program+settings, never touch logs/week.
create or replace function public.gym_admin_push_program(
  p_admin_pin text, p_target_id uuid, p_program jsonb, p_settings jsonb
)
returns timestamptz
language plpgsql
security definer
set search_path = public, extensions
as $$
declare ts timestamptz;
begin
  if public._gym_admin_id(p_admin_pin) is null then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  update public.profiles
    set state = state || jsonb_build_object('program', p_program, 'settings', p_settings),
        updated_at = now()
    where id = p_target_id
    returning updated_at into ts;
  return ts;
end;
$$;

-- ── expose only the intended RPCs to the public anon key ─────────────────────
grant execute on function public.gym_list_profiles() to anon, authenticated;
grant execute on function public.gym_login(text, text) to anon, authenticated;
grant execute on function public.gym_pull(uuid, text) to anon, authenticated;
grant execute on function public.gym_push(uuid, text, jsonb) to anon, authenticated;
grant execute on function public.gym_bootstrap_admin(text, text) to anon, authenticated;
grant execute on function public.gym_admin_list(text) to anon, authenticated;
grant execute on function public.gym_admin_create(text, text, text, boolean) to anon, authenticated;
grant execute on function public.gym_admin_reset_pin(text, uuid, text) to anon, authenticated;
grant execute on function public.gym_admin_delete(text, uuid) to anon, authenticated;
grant execute on function public.gym_admin_pull(text, uuid) to anon, authenticated;
grant execute on function public.gym_admin_push_program(text, uuid, jsonb, jsonb) to anon, authenticated;
