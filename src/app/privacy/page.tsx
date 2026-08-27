import type { Metadata } from "next";
import { MarketingShell, Prose } from "@/components/marketing/marketing-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Lunova collects, why, how long it's kept, and the controls you have.",
};

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <Prose title="Privacy Policy" updated="2026">
        <p>
          This is a plain-language summary of how Lunova handles your data. It
          describes the product as built; a full legal policy accompanies any
          production launch.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Account:</strong> email, hashed password, date of birth (for the 18+ gate — never shown), optional phone.</li>
          <li><strong>Profile:</strong> the photos, prompts, interests, music and activity you choose to add, plus an approximate location.</li>
          <li><strong>Activity:</strong> likes, matches, messages, and settings changes.</li>
          <li><strong>Safety signals:</strong> verification status, reports, and moderation events — kept private and used only for trust &amp; safety.</li>
          <li><strong>Technical:</strong> session and device information, and IP addresses for security and abuse prevention.</li>
        </ul>

        <h2>How location is handled</h2>
        <p>
          Your city is converted to a coarse coordinate. We compute distance from
          it, and never store or expose anything more precise — no exact address,
          workplace, or real-time position.
        </p>

        <h2>Who can see what</h2>
        <p>
          You control the visibility of your profile, music, activity and
          distance independently. Email, phone, exact age (optional) and precise
          location are never shown to other members.
        </p>

        <h2>Retention &amp; deletion</h2>
        <ul>
          <li>You can delete your account at any time. We remove your profile, photos, likes and notifications, and anonymise the account record so others&apos; conversations stay coherent.</li>
          <li>Verification selfies are deleted as soon as the check completes.</li>
          <li>Limited security and moderation records may be retained where required for safety.</li>
        </ul>

        <h2>Your rights</h2>
        <p>
          You can access, correct, export and delete your data from Settings. The
          architecture is built to support regional privacy requirements around
          consent, access and deletion.
        </p>
      </Prose>
    </MarketingShell>
  );
}
