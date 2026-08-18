import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_NONCE_COOKIE } from "@/lib/auth-session";

function isPublicPath(path: string) {
  return (
    path === "/login" ||
    path.startsWith("/api/auth/login") ||
    path.startsWith("/_next") ||
    path === "/favicon.ico"
  );
}

function clearSessionCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-") || cookie.name === SESSION_NONCE_COOKIE) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
}

function redirectToLogin(request: NextRequest, reason?: "replaced") {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (reason) url.searchParams.set("reason", reason);
  const response = NextResponse.redirect(url);
  clearSessionCookies(request, response);
  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = isPublicPath(path);

  if (!user && !isPublic) {
    return redirectToLogin(request);
  }

  if (user && !isPublic) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("session_nonce")
      .eq("id", user.id)
      .maybeSingle();

    // Column missing (migration not applied yet) — do not lock users out.
    if (!error && profile?.session_nonce) {
      const cookieNonce = request.cookies.get(SESSION_NONCE_COOKIE)?.value ?? "";
      if (cookieNonce !== profile.session_nonce) {
        if (path.startsWith("/api/")) {
          const response = NextResponse.json(
            { error: "Signed in on another device." },
            { status: 401 },
          );
          clearSessionCookies(request, response);
          return response;
        }
        return redirectToLogin(request, "replaced");
      }
    }
  }

  return supabaseResponse;
}
