import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const OAUTH_NEXT_COOKIE = "keuraoke_oauth_next";

function safeNextPath(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.startsWith("/auth/")
  ) {
    return "/";
  }
  return value;
}

function redirect(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.cookies.set(OAUTH_NEXT_COOKIE, "", {
    maxAge: 0,
    path: "/auth/callback",
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
  });
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (process.env.NODE_ENV === "development") {
    console.info("[auth/callback] Callback reached; authorization code present:", Boolean(code));
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return redirect(request, "/login?error=configuration");
  }
  if (!code) {
    return redirect(request, "/login?error=oauth");
  }

  try {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      if (process.env.NODE_ENV === "development") {
        console.error("[auth/callback] Code exchange failed:", exchangeError.message);
      }
      return redirect(request, "/login?error=oauth");
    }
    if (process.env.NODE_ENV === "development") {
      console.info("[auth/callback] Code exchange succeeded.");
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return redirect(request, "/login?error=session");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("auth_user_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (profileError) {
      return redirect(request, "/profile?error=profile");
    }
    if (!profile) {
      return redirect(request, "/profile?setup=1");
    }

    const nextPath = safeNextPath(request.cookies.get(OAUTH_NEXT_COOKIE)?.value ?? null);
    return redirect(request, nextPath);
  } catch (error: unknown) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[auth/callback] Callback failed:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
    return redirect(request, "/login?error=network");
  }
}
