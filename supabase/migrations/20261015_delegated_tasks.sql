-- ============================================================================
-- BDP CRM migration — delegated tasks (standalone + rich fields + reminders)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → New query → paste this whole
-- file → Run. Idempotent: safe to run more than once.
--
-- WHAT IT DOES (adds only, never alters existing data or drops anything):
--   1. followup_tasks gains description / created_by / priority so the owner can
--      delegate rich standalone tasks (business_id is already nullable, so a
--      task needs NO lead/company link to persist).
--   2. Indexes for the daily reminder scan (assignee + status) and for linking
--      task notifications (notifications.app_ref already exists — the API stores
--      the task ref there so "clear task" can retire its notifications).
--   3. RLS/GRANTs: followup_tasks + notifications already carry the
--      bdp_crm_authenticated_all policy from the base migration; this only
--      re-asserts the GRANTs so the new columns are reachable via the Data API.
-- ============================================================================

alter table public.followup_tasks add column if not exists description text not null default '';
alter table public.followup_tasks add column if not exists created_by text;
alter table public.followup_tasks add column if not exists priority text not null default 'normal';

create index if not exists followup_tasks_assignee_status_idx
  on public.followup_tasks (assignee, status);
create index if not exists followup_tasks_crm_ref_idx
  on public.followup_tasks (crm_ref);
create index if not exists notifications_app_ref_idx
  on public.notifications (app_ref);

-- Re-assert Data API reachability (no-op when already granted).
grant select, insert, update, delete on public.followup_tasks to authenticated;
grant select, insert, update, delete on public.notifications to authenticated;
grant usage, select on all sequences in schema public to authenticated;
