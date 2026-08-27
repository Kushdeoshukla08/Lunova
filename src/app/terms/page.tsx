import type { Metadata } from "next";
import { MarketingShell, Prose } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "Terms",
  description: "The house rules for using Lunova.",
};

export default function TermsPage() {
  return (
    <MarketingShell>
      <Prose title="Terms of Use" updated="2026">
        <p>A short version of the rules. A full agreement accompanies any production launch.</p>

        <h2>Who can use Lunova</h2>
        <ul>
          <li>You must be 18 or older.</li>
          <li>One account per person. Accurate information, real photos of you.</li>
        </ul>

        <h2>Be decent</h2>
        <ul>
          <li>No harassment, hate speech, threats, or unwanted sexual content.</li>
          <li>No impersonation, scams, spam, or soliciting money.</li>
          <li>No sharing other people&apos;s private information or intimate images.</li>
        </ul>

        <h2>Enforcement</h2>
        <p>
          We may warn, restrict, suspend or permanently remove accounts that break
          these rules. Serious violations — especially those involving minors or
          threats of harm — result in an immediate ban and, where appropriate,
          referral to authorities.
        </p>

        <h2>Your content</h2>
        <p>
          You keep ownership of what you post. You grant Lunova the permission
          needed to display it within the product. You can remove it, or your
          whole account, at any time.
        </p>

        <h2>No guarantees</h2>
        <p>
          Lunova helps you discover people. It can&apos;t promise a match, a reply,
          or an outcome — and its compatibility signals are a guide, not a
          prediction.
        </p>
      </Prose>
    </MarketingShell>
  );
}
