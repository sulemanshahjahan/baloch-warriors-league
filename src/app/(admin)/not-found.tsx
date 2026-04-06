import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AdminNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <h1 className="text-5xl font-black text-primary mb-2">404</h1>
      <h2 className="text-xl font-bold mb-3">Page Not Found</h2>
      <p className="text-muted-foreground mb-6">
        This admin page doesn&apos;t exist.
      </p>
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>
    </div>
  );
}
