import { PublicNavbar } from "@/components/public/navbar";
import { PublicFooter } from "@/components/public/footer";
import { MobileTabBar } from "@/components/public/mobile-tab-bar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <PublicNavbar />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <PublicFooter />
      <MobileTabBar />
    </div>
  );
}
