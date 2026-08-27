import { Wordmark } from "@/components/brand/wordmark";
import { LogoutButton } from "@/components/auth/logout-button";

export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="aurora flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Wordmark href={null} />
        <LogoutButton />
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pb-16">{children}</main>
    </div>
  );
}
