"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PublicError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-3">Something went wrong</h2>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          An error occurred while loading this page. Try again or go back home.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => unstable_retry()}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
