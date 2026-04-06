"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Trophy,
  Users,
  User,
  Swords,
  BarChart3,
  Award,
  Newspaper,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Tournaments",
    href: "/admin/tournaments",
    icon: Trophy,
  },
  {
    label: "Teams",
    href: "/admin/teams",
    icon: Users,
  },
  {
    label: "Players",
    href: "/admin/players",
    icon: User,
  },
  {
    label: "Matches",
    href: "/admin/matches",
    icon: Swords,
  },
  {
    label: "Standings",
    href: "/admin/standings",
    icon: BarChart3,
  },
  {
    label: "Awards",
    href: "/admin/awards",
    icon: Award,
  },
  {
    label: "News",
    href: "/admin/news",
    icon: Newspaper,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-card border-r border-border shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
        <Image
          src="/logo.png"
          alt="BWL"
          width={36}
          height={36}
          className="rounded-lg object-contain"
        />
        <div>
          <p className="font-bold text-sm leading-none">BWL Admin</p>
          <p className="text-xs text-muted-foreground mt-0.5">Dashboard</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer links */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Globe className="w-4 h-4" />
          View Site
        </Link>
      </div>
    </aside>
  );
}
