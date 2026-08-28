import "server-only";
import { env } from "@/lib/env";
import { bestEffort, isRetryableHttp, withRetry } from "./resilience";

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

/**
 * Resend (https://resend.com) — plain REST, no SDK. Retries on 5xx / 429 /
 * network via the caller's `bestEffort` / `withRetry` wrapper.
 */
class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async send({ to, subject, text }: EmailMessage): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.from, to, subject, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`resend ${res.status}: ${body.slice(0, 200)}`) as Error & {
        status: number;
      };
      err.status = res.status;
      throw err;
    }
  }
}

function build(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case "resend":
      if (!env.RESEND_API_KEY) {
        console.warn("[email] EMAIL_PROVIDER=resend but RESEND_API_KEY is unset — using console");
        return new ConsoleEmailProvider();
      }
      return new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
    // case "ses": return new SesEmailProvider(...);
    default:
      return new ConsoleEmailProvider();
  }
}

const globalForEmail = globalThis as unknown as { emailProvider?: EmailProvider };
const impl: EmailProvider =
  globalForEmail.emailProvider ?? (globalForEmail.emailProvider = build());

export const emailProvider: EmailProvider = {
  name: impl.name,
  /** Retried + timed out; throws only after exhausting retries. */
  async send(message) {
    await withRetry(() => impl.send(message), {
      label: `email.send(${impl.name})`,
      retries: 2,
      timeoutMs: 8_000,
      retryable: isRetryableHttp,
    });
  },
};

/**
 * Send where a miss is tolerable (a verification code the user can re-request):
 * retry, then log and move on rather than failing the user's flow.
 */
export async function sendEmailBestEffort(message: EmailMessage): Promise<{ ok: boolean }> {
  return bestEffort(`email.send(${impl.name})`, () => impl.send(message), {
    retries: 2,
    timeoutMs: 8_000,
    retryable: isRetryableHttp,
  });
}
