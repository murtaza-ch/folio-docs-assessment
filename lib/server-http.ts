import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { repository } from "./server-db";
import { AppError, documentService } from "./server-service";
import { idSchema } from "./validation";

export const DEMO_USER_ID = "11111111-1111-4111-8111-111111111111";
export const SESSION_COOKIE = "folio_demo_user";
export const service = documentService(repository);
export async function currentUser() {
  const stored = (await cookies()).get(SESSION_COOKIE)?.value;
  const id =
    stored && idSchema.safeParse(stored).success ? stored : DEMO_USER_ID;
  const user = await repository.getUser(id);
  if (!user)
    throw new AppError(
      401,
      "UNAUTHENTICATED",
      "Select a demo account to continue.",
    );
  return user;
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > 2_000_000)
    throw new AppError(413, "TOO_LARGE", "Document exceeds the size limit.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request must contain valid JSON.");
  }
  return schema.parse(body);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new AppError(403, "FORBIDDEN", "Requests must come from this app.");
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new AppError(403, "FORBIDDEN", "Requests must come from this app.");
}
export async function handle(action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof AppError)
      return json(
        {
          error: error.message,
          code: error.code,
          ...(error.document ? { document: error.document } : {}),
        },
        error.status,
      );
    if (error instanceof z.ZodError)
      return json(
        {
          error: error.issues[0]?.message ?? "Invalid request.",
          code: "VALIDATION_ERROR",
        },
        400,
      );
    console.error(
      "API request failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    return json(
      {
        error: "Unable to reach the database. Please try again.",
        code: "DATABASE_ERROR",
      },
      503,
    );
  }
}
