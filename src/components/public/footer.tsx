import Link from "next/link";
import Image from "next/image";

export function PublicFooter() {
  return (
    <footer className="border-t border-border/50 bg-card/30 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
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

          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              ["Tournaments", "/tournaments"],
              ["Matches", "/matches"],
              ["Players", "/players"],
              ["Teams", "/teams"],
              ["Stats", "/stats"],
              ["News", "/news"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
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
