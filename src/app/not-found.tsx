import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="aurora flex min-h-full flex-col">
      <header className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-8">
        <Wordmark />
      </header>
      <main className="flex flex-1 items-center justify-center px-5">
        <div className="max-w-sm text-center">
          <p className="font-display text-5xl text-glow">404</p>
          <h1 className="mt-3 text-xl font-display tracking-tight">
            This page drifted out of orbit
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            The link may be old, or the thing it pointed to is gone.
          </p>
          <Link href="/" className={buttonVariants({ className: "mt-5" })}>
            Back to Lunova
          </Link>
        </div>
      </main>
    </div>
  );
}
