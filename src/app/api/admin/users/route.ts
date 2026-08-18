import { NextResponse } from "next/server";
import {
  getServiceClient,
  missingServiceKeyResponse,
  requireAdmin,
} from "@/lib/supabase/admin-api";

function usernameFromEmail(email: string) {
  return email
    .split("@")[0]
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 40);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    fullName?: string;
    username?: string;
    email?: string;
    password?: string;
    role?: string;
    isActive?: boolean;
  } | null;

  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const fullName = String(body?.fullName ?? "").trim();
  const username =
    String(body?.username ?? "").trim() || usernameFromEmail(email);
  const role = body?.role === "admin" ? "admin" : "staff";
  const isActive = body?.isActive !== false;

  if (!fullName || !email || !password) {
    return NextResponse.json(
      { error: "Full name, email, and password are required." },
      { status: 400 },
    );
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  const service = getServiceClient();
  if (!service) return missingServiceKeyResponse();

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, username, role },
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data.user) {
    return NextResponse.json({ error: "Could not create user." }, { status: 500 });
  }

  const { error: profileError } = await service.from("profiles").upsert({
    id: data.user.id,
    tenant_id: data.user.id,
    full_name: fullName,
    username,
    role,
    is_active: isActive,
    login_password: password,
    updated_at: new Date().toISOString(),
  });
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  await service.rpc("seed_tenant_defaults", { p_tenant: data.user.id });

  return NextResponse.json({ id: data.user.id, email });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth && auth.error) return auth.error;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    fullName?: string;
    username?: string;
    email?: string;
    password?: string;
    role?: string;
    isActive?: boolean;
  } | null;

  const id = String(body?.id ?? "").trim();
  if (!id) {
    return NextResponse.json({ error: "User id is required." }, { status: 400 });
  }

  const service = getServiceClient();
  if (!service) return missingServiceKeyResponse();

  const email = body?.email != null ? String(body.email).trim().toLowerCase() : "";
  const password = body?.password != null ? String(body.password) : "";
  const fullName = body?.fullName != null ? String(body.fullName).trim() : "";
  const username = body?.username != null ? String(body.username).trim() : "";
  const role =
    body?.role === "admin" ? "admin" : body?.role === "staff" ? "staff" : undefined;
  const isActive = body?.isActive;

  if (email && !isValidEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password && password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  const authPatch: {
    email?: string;
    password?: string;
    email_confirm?: boolean;
    user_metadata?: Record<string, string>;
  } = {};
  if (email) {
    authPatch.email = email;
    authPatch.email_confirm = true;
  }
  if (password) authPatch.password = password;
  if (fullName || username || role) {
    authPatch.user_metadata = {
      ...(fullName ? { full_name: fullName } : {}),
      ...(username ? { username } : {}),
      ...(role ? { role } : {}),
    };
  }

  if (Object.keys(authPatch).length > 0) {
    const { error } = await service.auth.admin.updateUserById(id, authPatch);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const profilePatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (fullName) profilePatch.full_name = fullName;
  if (username) profilePatch.username = username;
  if (role) profilePatch.role = role;
  if (typeof isActive === "boolean") profilePatch.is_active = isActive;
  if (password) profilePatch.login_password = password;

  const { error: profileError } = await service
    .from("profiles")
    .update(profilePatch)
    .eq("id", id);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({ id });
}
