import { z } from "zod";
export const commentBodySchema = z
  .string()
  .trim()
  .min(1, "Write a comment before posting.")
  .max(2000, "Comments can have up to 2,000 characters.");
export const createCommentSchema = z
  .object({ body: commentBodySchema })
  .strict();
export const updateCommentSchema = z
  .object({
    body: commentBodySchema.optional(),
    resolved: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => value.body !== undefined || value.resolved !== undefined,
    "Supply a comment or resolution status.",
  );
export const versionNumberSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(Number.MAX_SAFE_INTEGER);
export const restoreVersionSchema = z
  .object({ version: z.number().int().positive() })
  .strict();
