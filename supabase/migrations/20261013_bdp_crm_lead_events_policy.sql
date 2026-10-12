-- ============================================================================
-- BDP CRM migration 2 — activity/audit write access
-- ----------------------------------------------------------------------------
-- HOW TO APPLY: Dashboard → SQL Editor → New query → paste → Run. Idempotent.
--
-- WHY: lead_events (activity timeline) carries a pre-existing restrictive
-- INSERT policy from the lead pipeline, so signed-in CRM users can read it
-- but every activity write is rejected (HTTP 403 "violates row-level
-- security policy"). That also keeps the app's sync status on error.
-- This adds a permissive policy for signed-in users WITHOUT dropping any
-- existing policies (PostgREST allows a row when ANY permissive policy
-- passes, so pipeline behavior is unchanged; service-key writes bypass RLS).
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array['lead_events'] loop
    execute format('alter table public.%I enable row level security', t);

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'bdp_crm_authenticated_all'
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
end $$;
