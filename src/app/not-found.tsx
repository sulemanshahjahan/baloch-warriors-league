import Link from "next/link";
import { Trophy, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased flex items-center justify-center">
        <div className="text-center px-4 py-16">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 mx-auto mb-6">
            <Trophy className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-6xl font-black text-primary mb-2">404</h1>
          <h2 className="text-2xl font-bold mb-3">Page Not Found</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </body>
    </html>
  );
}
