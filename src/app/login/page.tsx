import Link from "next/link";
import Image from "next/image";
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
        <section aria-labelledby="support-heading" className="support-card">
          <h2 id="support-heading">❤️ SUPPORT MY DREAM APP</h2>
          <p className="support-scan-label">SCAN TO SUPPORT</p>
          <Image
            alt="KEURAOKE GCash support QR code"
            className="support-qr"
            height={1988}
            src="/gcash-qr.png"
            unoptimized
            width={1080}
          />
          <p className="support-message">
            I have my GCash QR Code for all the kind-hearted people out there who would like to
            support me. Any amount, big or small, will help me build, improve, and upgrade KEURAOKE
            and turn my dream app into something successful.
            <br />
            <br />
            Thank you so much for your support. God bless you! 🙏❤️
          </p>
        </section>
      </div>
    </main>
  );
}
