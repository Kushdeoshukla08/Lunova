import { requireOnboardedUser } from "@/lib/auth/dal";
import { unreadConversationCount } from "@/lib/conversations/service";
import { unreadNotificationCount } from "@/lib/notifications/service";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppGroupLayout({ children }: LayoutProps<"/">) {
  const user = await requireOnboardedUser();
  const [unreadConnections, unreadNotifications] = await Promise.all([
    unreadConversationCount(user.id),
    unreadNotificationCount(user.id),
  ]);
  return (
    <AppShell
      user={user}
      unreadConnections={unreadConnections}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </AppShell>
  );
}
