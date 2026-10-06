import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { BottomNavigation } from "@/components/bottom-navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "KEURAOKE — Search a song and start singing",
  description:
    "KEURAOKE is a mobile-first karaoke discovery and playback web app powered by YouTube.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
          <BottomNavigation />
        </AuthProvider>
      </body>
    </html>
  );
}
