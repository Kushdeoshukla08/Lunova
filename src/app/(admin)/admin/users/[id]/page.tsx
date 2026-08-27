import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getUserAdminView } from "@/lib/admin/service";
import { UserAdminSummary } from "@/components/admin/user-admin-summary";
import { ModerationPanel } from "@/components/admin/moderation-panel";

export const metadata: Metadata = { title: "Member" };

export default async function AdminUserPage(props: PageProps<"/admin/users/[id]">) {
  const { id } = await props.params;
  const view = await getUserAdminView(id);
  if (!view) notFound();

  return (
    <div className="flex flex-col gap-5">
      <Link href="/admin" className="text-sm text-ink-soft hover:text-ink">
        ← Dashboard
      </Link>
      <UserAdminSummary view={view} />
      {view.user.status !== "DELETED" && (
        <ModerationPanel targetUserId={view.user.id} />
      )}
    </div>
  );
}
