import { SessionProvider } from "next-auth/react";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/sidebar";
import { prisma } from "@/lib/db";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Check test mode for banner
  const settings = await prisma.appSettings.findUnique({ where: { id: "global" } });
  const isTestMode = settings?.testMode ?? false;

  return (
    <SessionProvider session={session}>
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden lg:pt-0 pt-[65px]">
          {isTestMode && (
            <Link
              href="/admin/settings"
              className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center gap-2 text-xs text-amber-400 hover:bg-amber-500/15 transition-colors"
            >
              <span className="font-medium">Test Mode Active</span>
              <span className="text-amber-400/70">— All notifications are paused. Click to manage.</span>
            </Link>
          )}
          {children}
        </div>
      </div>
    </SessionProvider>
  );
}
