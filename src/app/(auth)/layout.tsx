import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="aurora flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-[26rem]">{children}</div>
      </main>
      <footer className="mx-auto w-full max-w-6xl px-5 py-6 text-center sm:px-8">
        <p className="text-xs text-ink-faint">
          By continuing you agree to Lunova&apos;s{" "}
          <Link href="/terms" className="underline hover:text-ink-soft">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-ink-soft">
            Privacy Policy
          </Link>
          .
        </p>
      </footer>
    </div>
  );
}
