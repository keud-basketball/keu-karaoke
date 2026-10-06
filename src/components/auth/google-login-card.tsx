"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

const loginErrors: Record<string, string> = {
  configuration: "Google login is not configured yet. Add the Supabase project URL and public anon key.",
  oauth: "Google login could not be completed. Please try again.",
  network: "Google login could not reach KEURAOKE. Check your connection and try again.",
  session: "Your sign-in session could not be verified. Please sign in again.",
  profile: "Your artist profile could not be checked. Please try again after the connection is restored.",
};

type GoogleLoginCardProps = {
  nextPath?: string;
  errorCode?: string;
};

export function GoogleLoginCard({ nextPath = "/", errorCode = "" }: GoogleLoginCardProps) {
  const { configured, signInWithGoogle } = useAuth();
  const [error, setError] = useState(() => (
    errorCode ? loginErrors[errorCode] ?? loginErrors.oauth : configured ? "" : loginErrors.configuration
  ));
  const [pending, setPending] = useState(false);

  async function login() {
    setError("");
    setPending(true);
    try {
      await signInWithGoogle(nextPath);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Google login failed. Please try again.");
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="google-login-heading" className="account-card">
      <p className="eyebrow">WELCOME TO KEURAOKE</p>
      <h1 id="google-login-heading">Sign in to share your voice</h1>
      <p className="account-description">
        Use your Google account to create a Recording Artist Profile and post performances.
        Your Google email stays private.
      </p>
      {error && <p className="account-error" role="alert">{error}</p>}
      <button
        className="button button-play google-login-button"
        disabled={!configured || pending}
        onClick={() => void login()}
        type="button"
      >
        <span aria-hidden="true">G</span>
        {pending ? "CONNECTING TO GOOGLE…" : "CONTINUE WITH GOOGLE"}
      </button>
      <p className="account-footnote">Google is the only sign-in method for KEURAOKE.</p>
    </section>
  );
}
