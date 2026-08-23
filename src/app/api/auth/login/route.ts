import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_INACTIVE_MESSAGE } from "@/lib/auth-messages";
import { SESSION_NONCE_COOKIE, nonceCookieOptions } from "@/lib/auth-session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;

  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({ email, password });

  if (signInError || !signInData.user) {
    return NextResponse.json(
      { error: signInError?.message || "Invalid email or password." },
      { status: 401 },
    );
  }

  const userId = signInData.user.id;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!profile || profile.is_active === false) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: ACCOUNT_INACTIVE_MESSAGE }, { status: 403 });
  }

  const sessionNonce = crypto.randomUUID();
  const { error: nonceError } = await supabase
    .from("profiles")
    .update({
      session_nonce: sessionNonce,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  await supabase.auth.signOut({ scope: "others" }).catch(() => {});

  if (!nonceError) {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_NONCE_COOKIE, sessionNonce, nonceCookieOptions());
    return NextResponse.json({ ok: true, sessionNonce });
  }

  return NextResponse.json({ ok: true });
}
