-- Run this SQL in Supabase SQL Editor.
-- This schema keeps pending registration data separate from approved student/driver records.

create extension if not exists pgcrypto;

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  login_id text not null unique,
  name text not null,
  phone_number text not null,
  role text not null check (role in ('student', 'driver')),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.students (
  user_id uuid primary key references auth.users(id) on delete cascade,
  registration_id uuid not null unique references public.registrations(id) on delete cascade,
  login_id text not null unique,
  name text not null,
  phone_number text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.drivers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  registration_id uuid not null unique references public.registrations(id) on delete cascade,
  login_id text not null unique,
  name text not null,
  phone_number text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.login_approvals (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  login_id text not null,
  role text not null check (role in ('student', 'driver')),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.driver_live_tracking (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  speed_kmh double precision not null default 0,
  distance_km double precision not null default 0,
  is_active boolean not null default false,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.buses (
  id uuid primary key default gen_random_uuid(),
  bus_number text not null unique,
  route_name text not null,
  plate text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive', 'maintenance')),
  assigned_driver_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operation_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('trip_started', 'trip_ended')),
  driver_user_id uuid not null references auth.users(id) on delete cascade,
  driver_name text not null,
  bus_id uuid references public.buses(id) on delete set null,
  bus_number text,
  distance_km double precision not null default 0,
  speed_kmh double precision not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  target_role text not null check (target_role in ('all', 'student', 'driver')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists driver_live_tracking_updated_idx
  on public.driver_live_tracking(updated_at desc);

create index if not exists buses_status_idx
  on public.buses(status);

create index if not exists buses_assigned_driver_idx
  on public.buses(assigned_driver_user_id);

create index if not exists operation_events_created_idx
  on public.operation_events(created_at desc);

create index if not exists admin_notifications_created_idx
  on public.admin_notifications(created_at desc);

insert into public.buses (bus_number, route_name, plate, status)
values
  ('Route 22', 'Campus Loop A', 'TN 22 AB 2242', 'active'),
  ('Route 18', 'Metro Connector', 'TN 18 AB 1828', 'active'),
  ('Route 42', 'City Link', 'TN 42 AB 4242', 'maintenance')
on conflict (bus_number) do nothing;

create unique index if not exists login_approvals_one_pending_per_user
  on public.login_approvals(user_id)
  where status = 'pending';

alter table public.registrations enable row level security;
alter table public.students enable row level security;
alter table public.drivers enable row level security;
alter table public.login_approvals enable row level security;
alter table public.driver_live_tracking enable row level security;
alter table public.buses enable row level security;
alter table public.operation_events enable row level security;
alter table public.admin_notifications enable row level security;

drop policy if exists "registrations_self_or_admin_select" on public.registrations;
drop policy if exists "registrations_self_insert" on public.registrations;
drop policy if exists "registrations_admin_update" on public.registrations;

drop policy if exists "students_self_or_admin_select" on public.students;
drop policy if exists "students_admin_insert" on public.students;

drop policy if exists "drivers_self_or_admin_select" on public.drivers;
drop policy if exists "drivers_admin_insert" on public.drivers;

drop policy if exists "approvals_self_or_admin_select" on public.login_approvals;
drop policy if exists "approvals_self_insert" on public.login_approvals;
drop policy if exists "approvals_admin_update" on public.login_approvals;

drop policy if exists "driver_tracking_select_authenticated" on public.driver_live_tracking;
drop policy if exists "driver_tracking_insert_self_or_admin" on public.driver_live_tracking;
drop policy if exists "driver_tracking_update_self_or_admin" on public.driver_live_tracking;

drop policy if exists "buses_select_authenticated" on public.buses;
drop policy if exists "buses_admin_insert" on public.buses;
drop policy if exists "buses_admin_update" on public.buses;

drop policy if exists "operation_events_select_authenticated" on public.operation_events;
drop policy if exists "operation_events_insert_self_or_admin" on public.operation_events;

drop policy if exists "admin_notifications_select_visible_targets" on public.admin_notifications;
drop policy if exists "admin_notifications_admin_insert" on public.admin_notifications;

create policy "registrations_self_or_admin_select"
  on public.registrations
  for select
  using (auth.uid() = user_id or auth.email() = 'transporter@admin.com');

create policy "registrations_self_insert"
  on public.registrations
  for insert
  with check (auth.uid() = user_id);

create policy "registrations_admin_update"
  on public.registrations
  for update
  using (auth.email() = 'transporter@admin.com')
  with check (auth.email() = 'transporter@admin.com');

create policy "students_self_or_admin_select"
  on public.students
  for select
  using (auth.uid() = user_id or auth.email() = 'transporter@admin.com');

create policy "students_admin_insert"
  on public.students
  for insert
  with check (auth.email() = 'transporter@admin.com');

create policy "drivers_self_or_admin_select"
  on public.drivers
  for select
  using (auth.uid() = user_id or auth.email() = 'transporter@admin.com');

create policy "drivers_admin_insert"
  on public.drivers
  for insert
  with check (auth.email() = 'transporter@admin.com');

create policy "approvals_self_or_admin_select"
  on public.login_approvals
  for select
  using (auth.uid() = user_id or auth.email() = 'transporter@admin.com');

create policy "approvals_self_insert"
  on public.login_approvals
  for insert
  with check (auth.uid() = user_id);

create policy "approvals_admin_update"
  on public.login_approvals
  for update
  using (auth.email() = 'transporter@admin.com')
  with check (auth.email() = 'transporter@admin.com');

create policy "driver_tracking_select_authenticated"
  on public.driver_live_tracking
  for select
  using (auth.uid() is not null);

create policy "driver_tracking_insert_self_or_admin"
  on public.driver_live_tracking
  for insert
  with check (auth.uid() = user_id or auth.email() = 'transporter@admin.com');

create policy "driver_tracking_update_self_or_admin"
  on public.driver_live_tracking
  for update
  using (auth.uid() = user_id or auth.email() = 'transporter@admin.com')
  with check (auth.uid() = user_id or auth.email() = 'transporter@admin.com');

create policy "buses_select_authenticated"
  on public.buses
  for select
  using (auth.uid() is not null);

create policy "buses_admin_insert"
  on public.buses
  for insert
  with check (auth.email() = 'transporter@admin.com');

create policy "buses_admin_update"
  on public.buses
  for update
  using (auth.email() = 'transporter@admin.com')
  with check (auth.email() = 'transporter@admin.com');

create policy "operation_events_select_authenticated"
  on public.operation_events
  for select
  using (auth.uid() is not null);

create policy "operation_events_insert_self_or_admin"
  on public.operation_events
  for insert
  with check (auth.uid() = driver_user_id or auth.email() = 'transporter@admin.com');

create policy "admin_notifications_select_visible_targets"
  on public.admin_notifications
  for select
  using (
    auth.email() = 'transporter@admin.com'
    or target_role = 'all'
    or (
      target_role = 'student'
      and exists (
        select 1 from public.students s where s.user_id = auth.uid()
      )
    )
    or (
      target_role = 'driver'
      and exists (
        select 1 from public.drivers d where d.user_id = auth.uid()
      )
    )
  );

create policy "admin_notifications_admin_insert"
  on public.admin_notifications
  for insert
  with check (auth.email() = 'transporter@admin.com');
