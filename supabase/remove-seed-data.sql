-- ============================================================================
-- Remove ALL demo seed data (sample squads, members' demo rows, leads, deals)
-- ----------------------------------------------------------------------------
-- HOW TO APPLY: Supabase Dashboard → SQL Editor → New query → paste this whole
-- file → Run. Idempotent: safe to run more than once; second run removes 0.
--
-- Matches ONLY fixed demo ids (ld-1001…, co-abc…, sq-mamba…, cm-1, …).
-- Real rows are never touched: everything created in the app uses random ids
-- (ld-x7k2…, co-9f1…), which match none of the lists below.
-- Audit history is intentionally left alone (it is the record of what happened,
-- including these deletions if you run this).
-- ============================================================================

-- 0. Show what is about to go (expect 0s if already clean)
SELECT 'businesses' AS t, count(*) FROM public.businesses WHERE legacy_place_id IN ('co-abc','co-sweven','co-prime','co-velvet','co-furaha','co-savannah','co-elimu','co-whitewave')
UNION ALL SELECT 'deals', count(*) FROM public.deals WHERE crm_ref IN ('op-2001','op-2002','op-2003','op-2004','op-2005')
UNION ALL SELECT 'squads', count(*) FROM public.squads WHERE app_ref IN ('sq-mamba','sq-zawadi','sq-jumuiya')
UNION ALL SELECT 'cohorts', count(*) FROM public.cohorts WHERE app_ref IN ('co-2026-q1','co-2025-q4')
UNION ALL SELECT 'campaigns', count(*) FROM public.campaigns WHERE name = 'Q1 Growth Sprint — Ordering & Reservations';

-- 1. Children first (foreign keys point at businesses/deals — deleting parents
--    first fails). Order matters; keep it.
DELETE FROM public.lead_events   WHERE legacy_place_id IN ('ld-1001','ld-1002','ld-1003','ld-1004','ld-1005','ld-1006','ld-1007','ld-1008');
DELETE FROM public.payments      WHERE crm_ref IN ('pay-1');
DELETE FROM public.proposals     WHERE crm_ref IN ('p-1');
DELETE FROM public.commissions   WHERE crm_ref IN ('cm-1');  -- its history in commission_events goes with it (cascade)
DELETE FROM public.meetings      WHERE crm_ref IN ('m-1','m-2','m-3');
DELETE FROM public.followup_tasks WHERE crm_ref IN ('t-1','t-2','t-3','t-4','t-5','t-6');
DELETE FROM public.contacts      WHERE crm_ref IN ('ct-1','ct-2','ct-3','ct-4','ct-5','ct-6');
DELETE FROM public.deals         WHERE crm_ref IN ('op-2001','op-2002','op-2003','op-2004','op-2005');

-- 2. Parents
DELETE FROM public.businesses WHERE legacy_place_id IN ('co-abc','co-sweven','co-prime','co-velvet','co-furaha','co-savannah','co-elimu','co-whitewave');
DELETE FROM public.notifications WHERE app_ref IN ('n-1','n-2','n-3','n-4');
DELETE FROM public.squads   WHERE app_ref IN ('sq-mamba','sq-zawadi','sq-jumuiya');
DELETE FROM public.cohorts  WHERE app_ref IN ('co-2026-q1','co-2025-q4');
DELETE FROM public.campaigns WHERE name = 'Q1 Growth Sprint — Ordering & Reservations';

-- 3. Confirm zero (all counts must be 0)
SELECT 'businesses' AS t, count(*) FROM public.businesses WHERE legacy_place_id IN ('co-abc','co-sweven','co-prime','co-velvet','co-furaha','co-savannah','co-elimu','co-whitewave')
UNION ALL SELECT 'contacts', count(*) FROM public.contacts WHERE crm_ref LIKE 'ct-%'
UNION ALL SELECT 'tasks', count(*) FROM public.followup_tasks WHERE crm_ref LIKE 't-%'
UNION ALL SELECT 'meetings', count(*) FROM public.meetings WHERE crm_ref LIKE 'm-%'
UNION ALL SELECT 'deals', count(*) FROM public.deals WHERE crm_ref LIKE 'op-%'
UNION ALL SELECT 'payments', count(*) FROM public.payments WHERE crm_ref LIKE 'pay-%'
UNION ALL SELECT 'proposals', count(*) FROM public.proposals WHERE crm_ref LIKE 'p-%'
UNION ALL SELECT 'commissions', count(*) FROM public.commissions WHERE crm_ref LIKE 'cm-%'
UNION ALL SELECT 'squads', count(*) FROM public.squads WHERE app_ref LIKE 'sq-%'
UNION ALL SELECT 'cohorts', count(*) FROM public.cohorts WHERE app_ref LIKE 'co-%'
UNION ALL SELECT 'notifications', count(*) FROM public.notifications WHERE app_ref LIKE 'n-%'
UNION ALL SELECT 'campaigns', count(*) FROM public.campaigns WHERE name = 'Q1 Growth Sprint — Ordering & Reservations';
