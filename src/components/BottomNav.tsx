"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/feed", label: "Feed", icon: "description" },
  { href: "/kept", label: "Kept", icon: "check_circle" },
  { href: "/settings", label: "Settings", icon: "settings" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 z-50 flex w-full justify-around border-t border-outline-variant/20 bg-white/95 px-3 pb-safe pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] backdrop-blur-md">
      {items.map(({ href, label, icon }) => {
        const active = pathname === href || (href !== "/feed" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center rounded-full px-5 py-1.5 transition-all ${
              active
                ? "bg-primary-fixed text-on-primary-fixed"
                : "text-secondary hover:text-primary"
            }`}
          >
            <span className="material-symbols-outlined">{icon}</span>
            <span className="font-label text-[11px] font-semibold uppercase tracking-wider">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
