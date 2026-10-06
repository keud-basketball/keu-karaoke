"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AuthStatus = "loading" | "signed-out" | "signed-in" | "unconfigured";

type AuthContextValue = {
  supabase: SupabaseClient<Database> | null;
  configured: boolean;
  authStatus: AuthStatus;
  userId: string | null;
  profile: Profile | null;
  profileLoading: boolean;
  profileError: string;
  avatarSrc: string | null;
  refreshProfile: () => Promise<void>;
  signInWithGoogle: (nextPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const OAUTH_NEXT_COOKIE = "keuraoke_oauth_next";

function clearOAuthNextCookie() {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${OAUTH_NEXT_COOKIE}=; Max-Age=0; Path=/auth/callback; SameSite=Lax${secure}`;
}

function safeNextPath(value: string) {
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.startsWith("/auth/")
  ) {
    return "/";
  }
  return value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => (
    typeof window === "undefined" ? null : createSupabaseBrowserClient()
  ));
  const configured = isSupabaseConfigured();
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    configured ? "loading" : "unconfigured",
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  const loadProfile = useCallback(async (client: SupabaseClient<Database>, id: string) => {
    setProfileLoading(true);
    setProfileError("");
    try {
      const { data, error } = await client
        .from("profiles")
        .select("auth_user_id,artist_name,avatar_url,created_at,updated_at")
        .eq("auth_user_id", id)
        .maybeSingle();

      if (error) {
        setProfile(null);
        setAvatarSrc(null);
        setProfileError("Your artist profile could not be loaded. Check your connection and try again.");
      } else {
        setProfile(data);
        if (data?.avatar_url) {
          const { data: signedAvatar, error: avatarError } = await client.storage
            .from("avatars")
            .createSignedUrl(data.avatar_url, 3600);
          if (avatarError) {
            setAvatarSrc(null);
            setProfileError("Your profile loaded, but its picture could not be displayed.");
          } else {
            setAvatarSrc(signedAvatar.signedUrl);
          }
        } else {
          setAvatarSrc(null);
        }
      }
    } catch {
      setProfile(null);
      setAvatarSrc(null);
      setProfileError("Your artist profile could not be loaded. Check your connection and try again.");
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setAuthStatus(session ? "signed-in" : "signed-out");
      if (session) {
        setProfileLoading(true);
        queueMicrotask(() => void loadProfile(supabase, session.user.id));
      } else {
        setProfile(null);
        setAvatarSrc(null);
        setProfileError("");
        setProfileLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile, supabase]);

  const refreshProfile = useCallback(async () => {
    if (!supabase || !userId) {
      setProfileError("Sign in with Google to load your artist profile.");
      return;
    }
    await loadProfile(supabase, userId);
  }, [loadProfile, supabase, userId]);

  const signInWithGoogle = useCallback(async (nextPath = "/") => {
    if (!supabase) {
      throw new Error("Google login is not configured yet. Add the Supabase environment variables and try again.");
    }
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${OAUTH_NEXT_COOKIE}=${encodeURIComponent(safeNextPath(nextPath))}; Max-Age=300; Path=/auth/callback; SameSite=Lax${secure}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      clearOAuthNextCookie();
      throw new Error("Google login could not start. Please try again.");
    }
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) {
      throw new Error("Authentication is not configured.");
    }
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error("Logout could not be completed. Check your connection and try again.");
  }, [supabase]);

  const value = useMemo<AuthContextValue>(() => ({
    supabase,
    configured,
    authStatus,
    userId,
    profile,
    profileLoading,
    profileError,
    avatarSrc,
    refreshProfile,
    signInWithGoogle,
    signOut,
  }), [
    supabase,
    configured,
    authStatus,
    userId,
    profile,
    profileLoading,
    profileError,
    avatarSrc,
    refreshProfile,
    signInWithGoogle,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
