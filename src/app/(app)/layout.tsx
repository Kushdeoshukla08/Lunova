import { requireOnboardedUser } from "@/lib/auth/dal";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppGroupLayout({ children }: LayoutProps<"/">) {
  const user = await requireOnboardedUser();
  return <AppShell user={user}>{children}</AppShell>;
}
