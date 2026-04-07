import Link from "next/link";
import Image from "next/image";
import { Download, Trophy, Swords, Users, BarChart3, Newspaper, Shield } from "lucide-react";

export function PublicFooter() {
  return (
    <footer className="border-t border-border/50 bg-card/30 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Download App Section */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10 p-6 rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border border-primary/20">
          <div className="text-center sm:text-left">
            <h3 className="font-bold text-lg">Get the BWL App</h3>
            <p className="text-sm text-muted-foreground">
              Download for Android — tournaments, matches & stats on the go!
            </p>
          </div>
          <a
            href="/bwl.apk"
            download
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            <Download className="w-5 h-5" />
            Download APK
          </a>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="BWL Logo"
              width={28}
              height={28}
              className="rounded-md object-contain"
            />
            <span className="font-bold text-sm">
              <span className="text-primary">BWL</span>
              <span className="ml-1 text-muted-foreground font-normal">
                Baloch Warriors League
              </span>
            </span>
          </Link>

          {/* Navigation Links with Icons */}
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              { label: "Tournaments", href: "/tournaments", icon: Trophy },
              { label: "Matches", href: "/matches", icon: Swords },
              { label: "Players", href: "/players", icon: Users },
              { label: "Teams", href: "/teams", icon: Shield },
              { label: "Stats", href: "/stats", icon: BarChart3 },
              { label: "News", href: "/news", icon: Newspaper },
            ].map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Icon className="w-3 h-3" />
                {label}
              </Link>
            ))}
          </nav>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Baloch Warriors League
          </p>
        </div>
      </div>
    </footer>
  );
}
