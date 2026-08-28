import { requireOnboardedUser } from "@/lib/auth/dal";
import { unreadConversationCount } from "@/lib/conversations/service";
import { unreadNotificationCount } from "@/lib/notifications/service";
import { getI18n } from "@/lib/i18n/locale";
import { AppShell } from "@/components/shell/app-shell";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import { TimeZoneSync } from "@/components/i18n/timezone-sync";

export default async function AppGroupLayout({ children }: LayoutProps<"/">) {
  const user = await requireOnboardedUser();
  const [unreadConnections, unreadNotifications, i18n] = await Promise.all([
    unreadConversationCount(user.id),
    unreadNotificationCount(user.id),
    getI18n(),
  ]);
  return (
    <RealtimeProvider>
      <TimeZoneSync current={i18n.timeZone} />
      <AppShell
        user={user}
        labels={i18n.dict.nav}
        unreadConnections={unreadConnections}
        unreadNotifications={unreadNotifications}
      >
        {children}
      </AppShell>
    </RealtimeProvider>
  );
}
