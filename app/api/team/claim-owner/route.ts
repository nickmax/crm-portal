import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );
}

// POST /api/team/claim-owner — one-time bootstrap.
// Succeeds only when NO auth-backed owner profile exists yet, so the first
// real human can claim ownership and it can never hijack an owned system.
export async function POST() {
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const svc = serviceClient();
  const { data: ownerProfiles } = await svc.from("profiles").select("id").eq("crm_role", "owner");
  for (const p of ((ownerProfiles ?? []) as { id: string }[])) {
    const { data: authUser } = await svc.auth.admin.getUserById(p.id);
    if (authUser?.user) {
      return NextResponse.json({ error: "An owner already exists. Ask them for access." }, { status: 403 });
    }
  }

  const { error } = await svc.from("profiles").upsert({
    id: user.id,
    email: user.email ?? null,
    crm_role: "owner",
  }, { onConflict: "id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await svc.from("audit_log").insert({
    actor: user.id, action: "Ownership claimed", entity: "profile",
    entity_id: user.id, detail: user.email ?? "",
  });
  return NextResponse.json({ ok: true });
}
