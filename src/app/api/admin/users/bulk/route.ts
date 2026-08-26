import { NextResponse } from "next/server";
import { createStaffUser } from "@/lib/admin-create-user";
import { parseBulkUserPaste } from "@/lib/bulk-users";
import {
  getServiceClient,
  missingServiceKeyResponse,
  requireAdmin,
} from "@/lib/supabase/admin-api";

const MAX_BULK = 80;

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    paste?: string;
    samePassword?: boolean;
    password?: string;
    role?: string;
    isActive?: boolean;
  } | null;

  const paste = String(body?.paste ?? "");
  const samePassword = body?.samePassword !== false;
  const password = String(body?.password ?? "");
  const role = body?.role === "admin" ? "admin" : "staff";
  const isActive = body?.isActive !== false;

  const parsed = parseBulkUserPaste(paste, { samePassword, password });
  if (parsed.entries.length === 0) {
    return NextResponse.json(
      {
        error:
          parsed.errors[0] ||
          "Paste at least one valid email. Use a shared password, or one email and password per line.",
        failures: parsed.errors.map((message) => ({ email: "", message })),
      },
      { status: 400 },
    );
  }
  if (parsed.entries.length > MAX_BULK) {
    return NextResponse.json(
      { error: `You can add at most ${MAX_BULK} users at a time.` },
      { status: 400 },
    );
  }

  const service = getServiceClient();
  if (!service) return missingServiceKeyResponse();

  const created: { id: string; email: string }[] = [];
  const failures: { email: string; message: string }[] = parsed.errors.map(
    (message) => ({ email: "", message }),
  );

  for (const entry of parsed.entries) {
    const result = await createStaffUser(service, {
      email: entry.email,
      password: entry.password,
      fullName: entry.fullName,
      username: entry.username,
      role,
      isActive,
    });
    if ("error" in result) {
      failures.push({ email: entry.email, message: result.error });
    } else {
      created.push(result);
    }
  }

  return NextResponse.json({
    created: created.length,
    failed: failures.length,
    users: created,
    failures,
  });
}
