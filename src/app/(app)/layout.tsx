import { requireOnboardedUser } from "@/lib/auth/dal";
import { unreadConversationCount } from "@/lib/conversations/service";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppGroupLayout({ children }: LayoutProps<"/">) {
  const user = await requireOnboardedUser();
  const unread = await unreadConversationCount(user.id);
  return (
    <AppShell user={user} unreadConnections={unread}>
      {children}
    </AppShell>
  );
}
