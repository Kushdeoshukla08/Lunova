import "server-only";
import { env } from "@/lib/env";

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

function build(): SmsProvider {
  switch (env.SMS_PROVIDER) {
    // case "twilio": return new TwilioSmsProvider(...);
    case "console":
    default:
      return new ConsoleSmsProvider();
  }
}

const globalForSms = globalThis as unknown as { smsProvider?: SmsProvider };
export const smsProvider: SmsProvider =
  globalForSms.smsProvider ?? (globalForSms.smsProvider = build());
