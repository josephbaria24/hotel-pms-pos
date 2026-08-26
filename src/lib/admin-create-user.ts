import type { SupabaseClient } from "@supabase/supabase-js";
import { fullNameFromEmail, usernameFromEmail } from "@/lib/bulk-users";

export async function createStaffUser(
  service: SupabaseClient,
  input: {
    email: string;
    password: string;
    fullName?: string;
    username?: string;
    role?: string;
    isActive?: boolean;
  },
): Promise<{ id: string; email: string } | { error: string }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const fullName = (input.fullName ?? "").trim() || fullNameFromEmail(email);
  const username = (input.username ?? "").trim() || usernameFromEmail(email);
  const role = input.role === "admin" ? "admin" : "staff";
  const isActive = input.isActive !== false;

  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, username, role },
  });
  if (error) return { error: error.message };
  if (!data.user) return { error: "Could not create user." };

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
  if (profileError) return { error: profileError.message };

  await service.rpc("seed_tenant_defaults", { p_tenant: data.user.id });
  return { id: data.user.id, email };
}
