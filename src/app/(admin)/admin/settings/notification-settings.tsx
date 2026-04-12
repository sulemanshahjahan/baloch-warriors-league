"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  BellOff,
  MessageCircle,
  Clock,
  Trophy,
  Gamepad2,
  ShieldAlert,
  Send,
  AlertTriangle,
} from "lucide-react";
import { toggleSetting } from "@/lib/actions/settings";
import { useRouter } from "next/navigation";
import type { AppSettings } from "@prisma/client";

interface NotificationSettingsProps {
  settings: AppSettings;
}

interface SettingRowProps {
  label: string;
  description: string;
  icon: React.ReactNode;
  pushKey: string;
  pushValue: boolean;
  waKey: string;
  waValue: boolean;
  disabled?: boolean;
  onToggle: (key: string, value: boolean) => void;
}

function SettingRow({ label, description, icon, pushKey, pushValue, waKey, waValue, disabled, onToggle }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="text-muted-foreground shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-6 shrink-0 ml-4">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-muted-foreground" />
          <Switch
            checked={pushValue}
            onCheckedChange={(v) => onToggle(pushKey, v)}
            disabled={disabled}
          />
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-3.5 h-3.5 text-green-500" />
          <Switch
            checked={waValue}
            onCheckedChange={(v) => onToggle(waKey, v)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

export function NotificationSettings({ settings }: NotificationSettingsProps) {
  const router = useRouter();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState<string | null>(null);

  async function handleToggle(key: string, value: boolean) {
    // Optimistic update
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setSaving(key);

    const result = await toggleSetting(key, value);
    if (!result.success) {
      // Revert on failure
      setLocalSettings((prev) => ({ ...prev, [key]: !value }));
    }

    setSaving(null);
    router.refresh();
  }

  const isTestMode = localSettings.testMode;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Test Mode Banner */}
      {isTestMode && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-400">Test Mode Active</p>
            <p className="text-xs text-muted-foreground">
              All push notifications and WhatsApp messages are disabled. Turn off to resume.
            </p>
          </div>
        </div>
      )}

      {/* Global Test Mode */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {isTestMode ? <BellOff className="w-4 h-4 text-amber-400" /> : <Bell className="w-4 h-4 text-green-400" />}
                Test Mode
              </CardTitle>
              <CardDescription className="mt-1">
                When enabled, all notifications are silently skipped. Use this for testing.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className={isTestMode ? "text-amber-400 border-amber-400/30" : "text-green-400 border-green-400/30"}>
                {isTestMode ? "Testing" : "Live"}
              </Badge>
              <Switch
                checked={isTestMode}
                onCheckedChange={(v) => handleToggle("testMode", v)}
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Channel Legend */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
        <span>Channels:</span>
        <span className="flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5" /> Push (Web + Mobile)
        </span>
        <span className="flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5 text-green-500" /> WhatsApp
        </span>
      </div>

      {/* Match Notifications */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Match Notifications</CardTitle>
          <CardDescription>Control when players and subscribers get notified about matches</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingRow
            label="Match Reminders & Deadlines"
            description="24h, 2h, 30min deadline warnings + magic link auto-send"
            icon={<Clock className="w-4 h-4" />}
            pushKey="pushMatchReminders"
            pushValue={localSettings.pushMatchReminders}
            waKey="waMatchReminders"
            waValue={localSettings.waMatchReminders}
            disabled={isTestMode}
            onToggle={handleToggle}
          />
          <SettingRow
            label="Score Submissions"
            description="When a player submits or confirms a score via magic link"
            icon={<Send className="w-4 h-4" />}
            pushKey="pushScoreSubmissions"
            pushValue={localSettings.pushScoreSubmissions}
            waKey="waScoreSubmissions"
            waValue={localSettings.waScoreSubmissions}
            disabled={isTestMode}
            onToggle={handleToggle}
          />
          <SettingRow
            label="Match Results"
            description="Final score notifications when a match is completed"
            icon={<Trophy className="w-4 h-4" />}
            pushKey="pushMatchResults"
            pushValue={localSettings.pushMatchResults}
            waKey="waMatchResults"
            waValue={localSettings.waMatchResults}
            disabled={isTestMode}
            onToggle={handleToggle}
          />
          <SettingRow
            label="Room ID / Lobby Sharing"
            description="When room credentials are shared for eFootball or PUBG matches"
            icon={<Gamepad2 className="w-4 h-4" />}
            pushKey="pushRoomId"
            pushValue={localSettings.pushRoomId}
            waKey="waRoomId"
            waValue={localSettings.waRoomId}
            disabled={isTestMode}
            onToggle={handleToggle}
          />
        </CardContent>
      </Card>

      {/* Tournament Notifications */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tournament Updates</CardTitle>
          <CardDescription>Announcements, group draws, and bracket updates</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingRow
            label="Tournament Announcements"
            description="New tournaments, group draws, bracket generation"
            icon={<Trophy className="w-4 h-4" />}
            pushKey="pushTournamentUpdates"
            pushValue={localSettings.pushTournamentUpdates}
            waKey="waTournamentUpdates"
            waValue={localSettings.waTournamentUpdates}
            disabled={isTestMode}
            onToggle={handleToggle}
          />
        </CardContent>
      </Card>

      {/* Admin Alerts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Admin Alerts</CardTitle>
          <CardDescription>Notifications for admin attention — disputes, overdue matches</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingRow
            label="Disputes & Overdue Alerts"
            description="Score disputes, overdue matches, system alerts"
            icon={<ShieldAlert className="w-4 h-4" />}
            pushKey="pushAdminAlerts"
            pushValue={localSettings.pushAdminAlerts}
            waKey="waAdminAlerts"
            waValue={localSettings.waAdminAlerts}
            disabled={isTestMode}
            onToggle={handleToggle}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Changes are saved automatically. Settings apply globally to all subscribers.
      </p>
    </div>
  );
}
