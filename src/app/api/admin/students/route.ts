import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user, supabase };
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as { ids?: string[] } | null;
  const ids = Array.isArray(body?.ids)
    ? [...new Set(body.ids.filter((id) => typeof id === "string" && id.length > 0))]
    : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No users selected" }, { status: 400 });
  }

  const selfId = auth.user!.id;
  const targets = ids.filter((id) => id !== selfId);
  if (targets.length === 0) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 },
    );
  }

  const service = getServiceClient();
  if (!service) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env.local to delete accounts.",
      },
      { status: 500 },
    );
  }

  const failures: { id: string; message: string }[] = [];
  let deleted = 0;

  for (const id of targets) {
    const { error: profileError } = await service
      .from("profiles")
      .delete()
      .eq("id", id);
    if (profileError) {
      failures.push({ id, message: profileError.message });
      continue;
    }

    const { error } = await service.auth.admin.deleteUser(id);
    if (error) {
      failures.push({ id, message: error.message });
      continue;
    }
    deleted += 1;
  }

  return NextResponse.json({ deleted, failures });
}
