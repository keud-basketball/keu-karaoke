import Link from "next/link";
import { GoogleLoginCard } from "@/components/auth/google-login-card";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = typeof params.next === "string" ? params.next : "/";
  const errorCode = typeof params.error === "string" ? params.error : "";

  return (
    <main className="app-shell page-shell account-shell">
      <div className="page-content account-content">
        <header className="page-header">
          <Link className="wordmark" href="/">KEURAOKE</Link>
          <p>Your voice. Your artist profile.</p>
        </header>
        <GoogleLoginCard errorCode={errorCode} nextPath={nextPath} />
      </div>
    </main>
  );
}
