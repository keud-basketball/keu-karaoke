"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";

const destinations = [
  { href: "/", label: "HOME / SEARCH", icon: "🏠" },
  { href: "/history", label: "HISTORY", icon: "🕘" },
  { href: "/favorites", label: "MY KARAOKE", icon: "❤️" },
  { href: "/queue", label: "QUEUE", icon: "🎤" },
  { href: "/socials", label: "SOCIALS", icon: "🌐" },
];

export function BottomNavigation() {
  const pathname = usePathname();
  const { authStatus } = useAuth();
  const accountDestination = authStatus === "signed-in"
    ? { href: "/profile", label: "PROFILE", icon: "🎙️" }
    : { href: "/login", label: "LOGIN", icon: "🔐" };
  const activePath = pathname === "/watch" || pathname === "/search" ? "/" : pathname;

  return (
    <nav className="bottom-navigation" aria-label="Main navigation">
      <div className="bottom-navigation-items">
        {destinations.map((destination) => {
          const isActive = activePath === destination.href;
          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`bottom-navigation-link${isActive ? " is-active" : ""}`}
              href={destination.href}
              key={destination.href}
            >
              <span aria-hidden="true">{destination.icon}</span>
              <span>{destination.label}</span>
            </Link>
          );
        })}
        <Link
          aria-current={activePath === accountDestination.href ? "page" : undefined}
          className={`bottom-navigation-link${activePath === accountDestination.href ? " is-active" : ""}`}
          href={accountDestination.href}
        >
          <span aria-hidden="true">{accountDestination.icon}</span>
          <span>{accountDestination.label}</span>
        </Link>
      </div>
    </nav>
  );
}
