import { NextResponse } from "next/server";
import {
  getServiceClient,
  missingServiceKeyResponse,
  requireAdmin,
} from "@/lib/supabase/admin-api";

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
  if (!service) return missingServiceKeyResponse();

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
