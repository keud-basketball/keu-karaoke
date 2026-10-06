import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { BottomNavigation } from "@/components/bottom-navigation";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://keuraoke.vercel.app"),

  title: {
    default: "KEURAOKE – Online Karaoke Songs & Singing",
    template: "%s | KEURAOKE",
  },

  description:
    "Search karaoke songs, sing along to YouTube karaoke tracks, build your queue, save favorites, and enjoy KEURAOKE.",

  keywords: [
    "KEURAOKE",
    "karaoke",
    "online karaoke",
    "karaoke songs",
    "sing online",
    "YouTube karaoke",
    "Filipino karaoke",
  ],

  alternates: {
    canonical: "https://keuraoke.vercel.app/",
  },

  openGraph: {
    title: "KEURAOKE – Online Karaoke Songs & Singing",
    description:
      "Search karaoke songs, sing along to YouTube karaoke tracks, build your queue, save favorites, and enjoy KEURAOKE.",
    url: "https://keuraoke.vercel.app/",
    siteName: "KEURAOKE",
    type: "website",
    images: [
      {
        url: "/keuraoke-logo.png",
        width: 512,
        height: 512,
        alt: "KEURAOKE Online Karaoke",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "KEURAOKE – Online Karaoke Songs & Singing",
    description:
      "Search karaoke songs, sing along to YouTube karaoke tracks, build your queue, save favorites, and enjoy KEURAOKE.",
    images: ["/keuraoke-logo.png"],
  },

  robots: {
    index: true,
    follow: true,

  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
          <meta
              name="google-site-verification"
                  content="4UAiVlhj7q_4z9OdLzktocfdYenv3GBQ4nudMsP7O6M"
                    />
                    </head>
      <body>
        <AuthProvider>
          {children}
          <BottomNavigation />
        </AuthProvider>
      </body>
    </html>
  );
}
