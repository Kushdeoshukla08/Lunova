import { cn } from "@/lib/cn";

/** Top-of-form status line for a Server Action result. */
export function FormMessage({
  error,
  notice,
  className,
}: {
  error?: string;
  notice?: string;
  className?: string;
}) {
  if (!error && !notice) return null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={cn(
        "rounded-[var(--radius-sm)] px-3 py-2 text-sm",
        error
          ? "bg-danger-soft text-danger"
          : "bg-ok-soft text-ok",
        className,
      )}
    >
      {error ?? notice}
    </p>
  );
}
