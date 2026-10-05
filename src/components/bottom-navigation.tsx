"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
  { href: "/", label: "HOME / SEARCH", icon: "🏠" },
  { href: "/history", label: "HISTORY", icon: "🕘" },
  { href: "/favorites", label: "MY KARAOKE", icon: "❤️" },
  { href: "/queue", label: "QUEUE", icon: "🎤" },
];

export function BottomNavigation() {
  const pathname = usePathname();
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
        <button
          className="bottom-navigation-link"
          onClick={() => window.alert("Login coming soon.")}
          type="button"
        >
          <span aria-hidden="true">🔐</span>
          <span>LOGIN</span>
        </button>
      </div>
    </nav>
  );
}
