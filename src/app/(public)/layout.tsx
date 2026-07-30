import { PublicShell } from "@/components/public/public-shell";
import { MobileTabBar } from "@/components/public/mobile-tab-bar";
import { PushPromptBanner } from "@/components/public/push-notification-button";
import { LiveRefresh } from "@/components/public/live-refresh";
import { BackButtonHandler } from "@/components/public/back-button-handler";
import { PresenceHeartbeat } from "@/components/public/presence-heartbeat";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen">
      <LiveRefresh interval={15000} />
      <BackButtonHandler />
      <PresenceHeartbeat />
      <PublicShell>{children}</PublicShell>
      <MobileTabBar />
      <PushPromptBanner />
    </div>
  );
}
