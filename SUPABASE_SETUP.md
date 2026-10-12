# BDP CRM ↔ Supabase setup

Project: `blnaiqmwawheabubipqt` · Region URL + keys live in `.env.local` (gitignored, never commit).

## 1. Apply the migration (one time, ~1 min)

The app's documents (MCP) can only reach other projects, so DDL must be run by you:

1. Open Supabase Dashboard → your project → **SQL Editor** → **New query**.
2. Paste the full contents of `supabase/migrations/20261012_bdp_crm_additive.sql` → **Run**.
3. It is idempotent — safe to re-run. It only **adds**: `crm_*` columns on
   `businesses/contacts/meetings/followup_tasks/deals/payments/campaigns/profiles`,
   plus new tables `cohorts/squads/proposals/commissions/commission_events/notifications/audit_log`,
   RLS policies and Data-API `GRANT`s (required since Supabase stopped auto-exposing tables on 2026-10-30).

## 2. Verify (proves it 100% works)

```bash
node scripts/verify-supabase.mjs
```

It checks: REST reachability, all 9 existing tables readable, all 7 new tables +
`crm_*` columns present, full auth roundtrip (create user → sign in → getUser →
delete user), write path (insert + delete a canary `businesses` row), and user
cleanup. Exit 0 = green. Before step 1, expect only the migration checks to fail —
everything else already passes.

## 3. Auth hooks — one-time setup so everything works together

No public sign-up exists: accounts are created by you when contracts are signed.

**A. URLs (Dashboard → Authentication → URL Configuration)**
- Site URL: `https://crm.mathengeinc.com`
- Additional Redirect URLs (one per line):
  - `https://crm.mathengeinc.com/**`
  - `https://crm-portal-blue.vercel.app/**`
  - `http://localhost:3000/**`

**B. Disable public sign-ups (Dashboard → Authentication → Providers → Email)**
- Turn OFF "Allow new users to sign up". Sign-in, invites, and password resets keep working.

**C. Email templates (Dashboard → Authentication → Email Templates)**
- Paste the branded files from `supabase/email-templates/` into:
  - "Invite user" ← `invite.html` (button → CRM set-password screen)
  - "Reset password" ← `recovery.html`
  - "Change email address" ← `email-change.html`
- They point at the app's `/auth/callback` route, which completes the link and
  lands the user on `/set-password` (first invite / reset) or `/` (email change).
- Your SMTP sender stays as configured; these only change the design + links.

**D. Giving someone access (when they sign their contract)**
1. Dashboard → Authentication → Users → **Invite user** → their work email.
   (They receive the branded invite and choose their password — no sign-up page.)
2. Table Editor → `profiles` → find their row → set:
   - `display_name` = full name (this is the BDP/captain name on every lead,
     task, meeting and commission — keep it accurate),
   - `crm_role` = `owner | admin | captain | bdp | sales`,
   - `squad_id` = their squad's numeric id (from `squads`),
   - `commission_rate` = e.g. `0.10` for BDPs.
3. Done — they sign in at `https://crm.mathengeinc.com/login` and see exactly
   what their role permits. Forgot-password works from the same screen.

## 4. How the data mapping works

| CRM concept | Supabase |
|---|---|
| Company | `businesses` via `legacy_place_id` |
| Lead (owner/status/next step) | same `businesses` row via `crm_lead_ref` |
| Live dedup search | `businesses` `ilike` on name/website/domain (all 29k rows) |
| Contact | `contacts` via `crm_ref` |
| Task | `followup_tasks` via `crm_ref` (`open↔pending`) |
| Meeting | `meetings` via `crm_ref` |
| Opportunity → Deal | one `deals` row via `crm_ref` (`crm_kind` flips `opportunity→deal`) |
| Client payment | `payments` (cents, `KES`) |
| Commission | `commissions` + `commission_events` |
| Activity / audit / notification | `lead_events` / `audit_log` / `notifications` |
| Cohort / squad / campaign extras | `cohorts` / `squads` (`app_ref`) / `campaigns.details` |

Money is stored in minor units (KES 1,000 → `100000`). Sync is write-through with
a status pill in the sidebar (`Supabase · synced/syncing/error`, tap to retry);
localStorage remains as offline fallback. `Reset demo data` is local-only and
never deletes remote rows; first sync seeds remote only when zero CRM rows exist.

## 5. Before wider rollout (hardening)

- Replace the demo `using (true)` RLS policies with squad/owner scoping
  (see the comment in the migration file); keep finance writes owner-only.
- Set `profiles.crm_role` for every user; turn off public sign-ups in
  Dashboard → Auth if invitations should be admin-only.
- Add a custom SMTP sender so auth emails come from your domain.
