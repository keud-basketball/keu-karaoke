import Link from "next/link";
import { ArtistProfileContent } from "@/components/socials/artist-profile-content";

type ArtistPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { userId } = await params;

  return (
    <main className="app-shell page-shell">
      <div className="page-content">
        <header className="page-header">
          <Link className="wordmark" href="/">KEURAOKE</Link>
          <p>Recording Artist</p>
        </header>
        <ArtistProfileContent userId={userId} />
      </div>
    </main>
  );
}
