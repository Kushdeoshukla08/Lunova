import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { error: "That email is too long." })
  .pipe(z.email({ error: "Enter a valid email address." }));

export const passwordSchema = z
  .string()
  .min(8, { error: "Use at least 8 characters." })
  .max(200, { error: "That's too long." })
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), {
    error: "Include at least one letter and one number.",
  });

/** 18+ age gate — evaluated on the server against the current date. */
export const birthdateSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), { error: "Enter your date of birth." })
  .transform((v) => new Date(v))
  .refine((d) => d <= new Date(), { error: "That date is in the future." })
  .refine((d) => yearsSince(d) >= 18, {
    error: "You must be 18 or older to use Lunova.",
  })
  .refine((d) => yearsSince(d) <= 120, { error: "Enter a valid date of birth." });

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  birthdate: birthdateSchema,
  acceptTerms: z
    .union([z.literal("on"), z.literal("true"), z.boolean()])
    .refine((v) => v === "on" || v === "true" || v === true, {
      error: "Please accept the terms to continue.",
    }),
});

export const logInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Enter your password." }).max(200),
});

export const verifyCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { error: "Enter the 6-digit code." }),
});

export function yearsSince(date: Date): number {
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) years--;
  return years;
}

export type SignUpInput = z.infer<typeof signUpSchema>;
export type LogInInput = z.infer<typeof logInSchema>;
