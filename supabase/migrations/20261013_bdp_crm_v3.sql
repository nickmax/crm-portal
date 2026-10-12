-- ============================================================================
-- BDP CRM migration 3 — activity writes + stable squad/cohort refs
-- ----------------------------------------------------------------------------
-- HOW TO APPLY: Dashboard → SQL Editor → New query → paste → Run. Idempotent.
--
-- 1. lead_events carries a pre-existing restrictive INSERT policy from the
--    lead pipeline, so signed-in CRM users get HTTP 403 on every activity
--    write. This adds a permissive policy WITHOUT dropping existing ones
--    (any passing policy allows the row; service-key writes bypass RLS, so
--    pipeline behavior is unchanged).
-- 2. cohorts/squads gain app_ref (stable ids the CRM uses to survive renames).
--    (An earlier draft of the CRM migration mentioned app_ref, but this
--    project ran before that edit — this is the first time it is applied.)
-- ============================================================================

alter table public.cohorts add column if not exists app_ref text unique;
alter table public.squads add column if not exists app_ref text unique;

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
