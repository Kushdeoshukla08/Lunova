import { z } from "zod";
import { ReportCategory } from "@/generated/prisma/enums";

export const reportSchema = z.object({
  subjectUserId: z.string().min(1),
  category: z.enum(ReportCategory, { error: "Choose a reason." }),
  details: z.string().trim().max(2000).optional().or(z.literal("")),
  // free-form context the client attaches (conversation id, message ids, photo id)
  conversationId: z.string().optional(),
  messageId: z.string().optional(),
});

export const blockSchema = z.object({
  userId: z.string().min(1),
  // optional: also file a report in the same step
  alsoReport: z.boolean().optional().default(false),
  category: z.enum(ReportCategory).optional(),
  details: z.string().trim().max(2000).optional(),
});

export const messageSchema = z.object({
  conversationId: z.string().min(1),
  body: z
    .string()
    .trim()
    .min(1, { error: "Say something first." })
    .max(4000, { error: "That's a lot — trim it down a little." }),
});

export type ReportInput = z.infer<typeof reportSchema>;
