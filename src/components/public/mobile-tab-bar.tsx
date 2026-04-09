"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Swords, Users, BarChart3, Home, Bug } from "lucide-react";

const tabs = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/tournaments", icon: Trophy, label: "Tours" },
  { href: "/matches", icon: Swords, label: "Matches" },
  { href: "/players", icon: Users, label: "Players" },
  { href: "/debug", icon: Bug, label: "Debug" },
];

export function MobileTabBar() {
  const pathname = usePathname();

  // Hide on admin pages
  if (pathname.startsWith("/admin") || pathname.startsWith("/login")) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const isActive = tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
