import { logOutAction } from "@/lib/auth/actions";
import { cn } from "@/lib/cn";

/** Sign out — a real form POST to a Server Action (works without JS). */
export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logOutAction}>
      <button
        type="submit"
        className={cn(
          "tap-target text-sm text-ink-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-glow rounded",
          className,
        )}
      >
        Sign out
      </button>
    </form>
  );
}
