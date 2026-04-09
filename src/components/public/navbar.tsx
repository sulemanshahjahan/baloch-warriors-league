"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X, Trophy, Users } from "lucide-react";
import { DownloadAppButton } from "./download-app-button";
import { SearchDialog } from "./search-dialog";
import { ThemeToggle } from "./theme-toggle";
import { PushNotificationButton } from "./push-notification-button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/tournaments", label: "Tournaments" },
  { href: "/matches", label: "Matches" },
  { href: "/teams", label: "Teams" },
  { href: "/players", label: "Players" },
  { href: "/stats", label: "Stats" },
  { href: "/rankings", label: "Rankings" },
  { href: "/news", label: "News" },
];

export function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="BWL Logo"
              width={36}
              height={36}
              className="rounded-lg object-contain"
            />
            <span className="font-bold tracking-tight">
              <span className="text-primary">BWL</span>
              <span className="hidden sm:inline text-foreground ml-1 font-medium text-sm opacity-80">
                Baloch Warriors League
              </span>
            </span>
          </Link>

          {/* Mobile Quick Actions - Center (only on mobile) */}
          <div className="flex md:hidden items-center gap-1">
            <SearchDialog />
            <PushNotificationButton />
            <ThemeToggle />
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                prefetch={true}
                className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <SearchDialog />
            <PushNotificationButton />
            <ThemeToggle />
            <DownloadAppButton variant="navbar-desktop" />
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2.5 rounded-lg text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              prefetch={true}
              onClick={() => setMobileOpen(false)}
              className="block px-4 py-3.5 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors min-h-[48px]"
            >
              {link.label}
            </Link>
          ))}
          <DownloadAppButton variant="navbar-mobile" />
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className="block px-4 py-3.5 rounded-lg text-base font-medium text-primary hover:bg-primary/10 transition-colors min-h-[48px] mt-2 border-t border-border/50 pt-4"
          >
            Admin Panel
          </Link>
        </div>
      )}
    </nav>
  );
}
