import "server-only";
import { env } from "@/lib/env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/** DEV provider — prints the email to the server console. Never used in production. */
class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send({ to, subject, text }: EmailMessage): Promise<void> {
    console.info(
      `\n📧  [dev email] → ${to}\n    ${subject}\n    ${text.replace(/\n/g, "\n    ")}\n`,
    );
  }
}

function build(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    // case "resend": return new ResendEmailProvider(env.RESEND_API_KEY!);
    case "console":
    default:
      return new ConsoleEmailProvider();
  }
}

const globalForEmail = globalThis as unknown as { emailProvider?: EmailProvider };
export const emailProvider: EmailProvider =
  globalForEmail.emailProvider ?? (globalForEmail.emailProvider = build());
