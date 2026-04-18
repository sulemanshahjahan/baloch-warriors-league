"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  Menu,
  X,
  MapPin,
  Calendar,
  ShieldCheck,
  Settings,
  Zap,
  UserPlus,
  Search,
  MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

const navItems = [
  {
    label: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Match Day",
    href: "/admin/match-day",
    icon: Zap,
  },
  {
    label: "Match Finder",
    href: "/admin/match-finder",
    icon: Search,
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
  {
    label: "Venues",
    href: "/admin/venues",
    icon: MapPin,
  },
  {
    label: "Seasons",
    href: "/admin/seasons",
    icon: Calendar,
  },
  {
    label: "Registrations",
    href: "/admin/registrations",
    icon: UserPlus,
  },
  {
    label: "Messages",
    href: "/admin/messages",
    icon: MessageCircle,
  },
  {
    label: "Admin Users",
    href: "/admin/users",
    icon: ShieldCheck,
  },
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
  },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {navItems.map((item) => {
        const active = isActive(item.href, item.exact);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors min-h-[44px]",
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
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
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
      <NavLinks onNavigate={onNavigate} />

      {/* Footer links */}
      <div className="px-3 py-4 border-t border-border space-y-1">
        <Link
          href="/"
          target="_blank"
          onClick={onNavigate}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Globe className="w-4 h-4" />
          View Site
        </Link>
      </div>
    </>
  );
}

export function AdminSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-card border-r border-border shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Header with Menu Button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="BWL"
              width={32}
              height={32}
              className="rounded-lg object-contain"
            />
            <div>
              <p className="font-bold text-sm leading-none">BWL Admin</p>
              <p className="text-xs text-muted-foreground mt-0.5">Dashboard</p>
            </div>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Open menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
              <div className="flex flex-col h-full">
                <SidebarContent onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  );
}
