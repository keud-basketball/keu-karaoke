import Link from "next/link";
import { ProfilePageContent } from "@/components/auth/profile-page-content";

type ProfilePageProps = {
  searchParams: Promise<{ setup?: string | string[]; error?: string | string[] }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const setup = params.setup === "1";
  const errorCode = typeof params.error === "string" ? params.error : "";

  return (
    <main className="app-shell page-shell account-shell">
      <div className="page-content account-content">
        <header className="page-header">
          <Link className="wordmark" href="/">KEURAOKE</Link>
          <p>Your Recording Artist Profile</p>
        </header>
        <ProfilePageContent initialSetup={setup} initialError={errorCode} />
      </div>
    </main>
  );
}
