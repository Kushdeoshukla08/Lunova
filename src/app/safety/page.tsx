import type { Metadata } from "next";
import { MarketingShell, Prose } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "Safety",
  description: "How Lunova keeps discovery safe — verification, privacy-aware location, and first-class blocking and reporting.",
};

export default function SafetyPage() {
  return (
    <MarketingShell>
      <Prose title="Safety at Lunova">
        <p>
          Safety isn&apos;t a settings screen you have to go find. It&apos;s built into
          how Lunova works.
        </p>

        <h2>Knowing who you&apos;re talking to</h2>
        <ul>
          <li><strong>Email and phone verification</strong> make throwaway accounts expensive to create.</li>
          <li><strong>Photo verification</strong> confirms someone&apos;s photos are really them. The selfie is compared, then deleted — it never appears on a profile.</li>
          <li>Verified members carry a badge. That&apos;s all others see — never a score, never a history.</li>
        </ul>

        <h2>Your location stays yours</h2>
        <ul>
          <li>We store an approximate point for distance maths and nothing more precise.</li>
          <li>Profiles show a rounded distance, or nothing if you turn it off.</li>
          <li>We never show a real-time location, a home, or a workplace.</li>
        </ul>

        <h2>You&apos;re always in control</h2>
        <ul>
          <li><strong>Block, report and unmatch</strong> are one tap away on every profile and conversation — and always free.</li>
          <li>Reports use clear categories and go to a real moderation team, with the surrounding context attached.</li>
          <li>You can pause discovery, go incognito, or delete your account and have your data anonymised at any time.</li>
        </ul>

        <h2>What we don&apos;t do</h2>
        <ul>
          <li>No public reputation scores. No &ldquo;3 people reported this person&rdquo; shaming.</li>
          <li>No selling your data. No location in a URL. No contact details on your profile.</li>
        </ul>

        <p>
          If something feels wrong, report it. If it&apos;s urgent and involves your
          safety, contact your local emergency services first.
        </p>
      </Prose>
    </MarketingShell>
  );
}
