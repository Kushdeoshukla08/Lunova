import "server-only";
import { env } from "@/lib/env";
import { bestEffort, isRetryableHttp, withRetry } from "./resilience";

export interface SmsMessage {
  /** E.164 phone number. */
  to: string;
  text: string;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<void>;
}

/** DEV provider — prints the SMS to the server console. Never used in production. */
class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  async send({ to, text }: SmsMessage): Promise<void> {
    console.info(`\n📱  [dev sms] → ${to}\n    ${text}\n`);
  }
}

/** Twilio — plain REST (Basic auth), no SDK. */
class TwilioSmsProvider implements SmsProvider {
  readonly name = "twilio";
  constructor(
    private sid: string,
    private token: string,
    private from: string,
  ) {}

  async send({ to, text }: SmsMessage): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`;
    const body = new URLSearchParams({ To: to, From: this.from, Body: text });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.sid}:${this.token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      const err = new Error(`twilio ${res.status}: ${detail.slice(0, 200)}`) as Error & {
        status: number;
      };
      err.status = res.status;
      throw err;
    }
  }
}

function build(): SmsProvider {
  switch (env.SMS_PROVIDER) {
    case "twilio":
      if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) {
        console.warn("[sms] SMS_PROVIDER=twilio but credentials are incomplete — using console");
        return new ConsoleSmsProvider();
      }
      return new TwilioSmsProvider(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN, env.TWILIO_FROM);
    default:
      return new ConsoleSmsProvider();
  }
}

const globalForSms = globalThis as unknown as { smsProvider?: SmsProvider };
const impl: SmsProvider =
  globalForSms.smsProvider ?? (globalForSms.smsProvider = build());

export const smsProvider: SmsProvider = {
  name: impl.name,
  async send(message) {
    await withRetry(() => impl.send(message), {
      label: `sms.send(${impl.name})`,
      retries: 2,
      timeoutMs: 8_000,
      retryable: isRetryableHttp,
    });
  },
};

/** Retry, then log and continue — the user can request another code. */
export async function sendSmsBestEffort(message: SmsMessage): Promise<{ ok: boolean }> {
  return bestEffort(`sms.send(${impl.name})`, () => impl.send(message), {
    retries: 2,
    timeoutMs: 8_000,
    retryable: isRetryableHttp,
  });
}
