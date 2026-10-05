import { redirect } from "next/navigation";

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  redirect(query ? `/?q=${encodeURIComponent(query)}` : "/");
}
