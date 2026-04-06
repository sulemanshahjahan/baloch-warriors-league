"use client";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased flex items-center justify-center">
        <div className="text-center px-4 py-16">
          <h1 className="text-4xl font-black mb-3">Something went wrong</h1>
          <p className="text-muted-foreground mb-2 max-w-md mx-auto">
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/60 mb-6 font-mono">
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={() => unstable_retry()}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-semibold hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
