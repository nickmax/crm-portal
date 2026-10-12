-- ============================================================================
-- Mathenge Inc. BDP CRM — additive migration
-- ----------------------------------------------------------------------------
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → New query → paste this whole
-- file → Run. It is idempotent: safe to run more than once.
--
-- WHAT IT DOES (adds only, never alters existing data or drops anything):
--   1. Adds CRM columns to existing tables (businesses, contacts, meetings,
--      followup_tasks, deals, payments, campaigns, profiles)
--   2. Creates new tables: cohorts, squads, proposals, commissions,
--      commission_events, notifications, audit_log
--   3. Enables RLS everywhere it touches + explicit GRANTs to `authenticated`
--      (required: since 2026-10-30 Supabase no longer auto-exposes tables to
--      the Data API — without GRANTs the CRM cannot read/write via REST)
--   4. Lets any signed-in user create their own profiles row on first login
--
-- CURRENCY: deals.value_cents / payments.amount_cents are minor units.
-- The CRM writes KES values as cents (KES 1,000 → 100000) with currency='KES'.
-- ============================================================================

-- ---------------------------------------------------------------- 1. PROFILES
alter table public.profiles
  add column if not exists crm_role text not null default 'bdp'
  check (crm_role in ('owner','admin','captain','bdp','sales'));
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists app_ref text unique;
alter table public.profiles add column if not exists commission_rate numeric not null default 0.10;
alter table public.profiles add column if not exists squad_id bigint;

-- ------------------------------------------------------- 2. COHORTS + SQUADS
create table if not exists public.cohorts (
  id bigint generated always as identity primary key,
  app_ref text unique,
  name text not null unique,
  description text,
  start_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.squads (
  id bigint generated always as identity primary key,
  app_ref text unique,
  cohort_id bigint references public.cohorts (id) on delete set null,
  name text not null,
  captain_id uuid references public.profiles (id) on delete set null,
  industry text,
  target integer not null default 30,
  created_at timestamptz not null default now()
);

-- profiles.squad_id → squads(id), added after squads exists (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_squad_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_squad_id_fkey
      foreign key (squad_id) references public.squads (id) on delete set null;
  end if;
end $$;

-- ------------------------------------------- 3. CRM COLUMNS ON LEAD PIPELINE
-- businesses: one row per discovered company. A CRM "lead" is the wrapper
-- (owner/status/next-step) around it, keyed by crm_lead_ref.
alter table public.businesses add column if not exists crm_lead_ref text unique;
alter table public.businesses add column if not exists crm_squad_id bigint;
alter table public.businesses add column if not exists crm_status text not null default 'new';
alter table public.businesses add column if not exists crm_next_action text;
alter table public.businesses add column if not exists crm_source text;
alter table public.businesses add column if not exists crm_value_cents bigint not null default 0;
alter table public.businesses add column if not exists crm_urgency text not null default 'medium';
alter table public.businesses add column if not exists crm_decision_maker text;
alter table public.businesses add column if not exists crm_evidence text;

-- contacts has no name/role columns natively; CRM details live in crm_*.
alter table public.contacts add column if not exists crm_ref text unique;
alter table public.contacts add column if not exists crm_name text;
alter table public.contacts add column if not exists crm_role text;
alter table public.contacts add column if not exists crm_is_decision_maker boolean not null default false;

-- meetings: attendees + next action + link back to the CRM lead.
alter table public.meetings add column if not exists crm_ref text unique;
alter table public.meetings add column if not exists lead_ref text;
alter table public.meetings add column if not exists attendees text[] not null default '{}';
alter table public.meetings add column if not exists next_action text;

-- followup_tasks: link back to the CRM lead. Status mapping:
-- app "open" <-> 'pending', app "done" <-> 'done' (overdue is computed).
alter table public.followup_tasks add column if not exists crm_ref text unique;
alter table public.followup_tasks add column if not exists lead_ref text;

-- deals: ONE row flows qualified → … → won/lost.
-- crm_kind='opportunity' until signed, then 'deal'. App "Deal" milestones → jsonb cents.
alter table public.deals add column if not exists crm_ref text unique;
alter table public.deals add column if not exists crm_kind text not null default 'opportunity';
alter table public.deals add column if not exists bdp_id uuid references public.profiles (id) on delete set null;
alter table public.deals add column if not exists sales_owner_id uuid references public.profiles (id) on delete set null;
alter table public.deals add column if not exists expected_close_at timestamptz;
alter table public.deals add column if not exists milestones jsonb not null default '[]'::jsonb;

-- payments: method + verification flag.
alter table public.payments add column if not exists crm_ref text unique;
alter table public.payments add column if not exists method text not null default 'Bank transfer';
alter table public.payments add column if not exists verified boolean not null default true;

-- campaigns: structured BDP content (offers, templates, checklist, resources, targets).
alter table public.campaigns add column if not exists details jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------- 4. NEW TABLES
create table if not exists public.proposals (
  id bigint generated always as identity primary key,
  deal_id bigint references public.deals (id) on delete cascade,
  crm_ref text unique,
  value_cents bigint,
  sent_at timestamptz,
  revisions integer not null default 0,
  status text not null default 'sent',
  open_decisions text,
  created_at timestamptz not null default now()
);

create table if not exists public.commissions (
  id bigint generated always as identity primary key,
  deal_id bigint references public.deals (id) on delete set null,
  bdp_id uuid references public.profiles (id) on delete set null,
  app_bdp text,
  crm_ref text unique,
  rate numeric,
  eligible_cents bigint,
  earned_cents bigint,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.commission_events (
  id bigint generated always as identity primary key,
  commission_id bigint references public.commissions (id) on delete cascade,
  actor text,
  action text,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  profile_id uuid references public.profiles (id) on delete cascade,
  app_ref text,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor text,
  action text not null,
  entity text,
  entity_id text,
  detail text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------- 5. RLS + DATA API GRANTS
-- Every table below is reachable through the Data API by signed-in users.
-- Demo-grade policy: any authenticated user can read/write CRM rows.
-- HARDENING PATH (before wider rollout): replace `using (true)` with
-- squad/owner scoping, e.g. businesses owner = auth.uid()::text, and keep
-- finance writes (commissions/verified payments) owner-only via a service key.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','cohorts','squads','businesses','contacts','meetings',
    'followup_tasks','deals','payments','campaigns','proposals',
    'commissions','commission_events','notifications','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    if not exists (
      select 1 from pg_policies where schemaname='public' and tablename=t and policyname='bdp_crm_authenticated_all'
    ) then
      execute format(
        'create policy bdp_crm_authenticated_all on public.%I for all to authenticated using (true) with check (true)',
        t
      );
    end if;

    execute format(
      'grant select, insert, update, delete on public.%I to authenticated',
      t
    );
  end loop;

  -- identity sequences must be usable for inserts via the Data API
  grant usage, select on all sequences in schema public to authenticated;

  -- first-login self-provisioning: a signed-in user may insert their own profile
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='bdp_crm_self_provision'
  ) then
    create policy bdp_crm_self_provision
      on public.profiles for insert to authenticated
      with check ((select auth.uid()) = id);
  end if;
end $$;
