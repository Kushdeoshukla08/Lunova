import Link from "next/link";

export function SettingsSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Link
        href="/settings"
        className="tap-target w-fit text-sm text-ink-soft hover:text-ink"
      >
        ← Settings
      </Link>
      <h1 className="text-2xl font-display tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-ink-soft text-pretty">{subtitle}</p>}
    </div>
  );
}
