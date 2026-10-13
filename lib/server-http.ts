import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { repository } from "./server-db";
import { AppError, documentService } from "./server-service";
import { auth, SESSION_SECONDS } from "./server-auth";

export const SESSION_COOKIE = "folio_session";
export const service = documentService(repository);
export async function currentSessionUser() {
  return auth.userForToken((await cookies()).get(SESSION_COOKIE)?.value);
}
export async function currentUser() {
  const user = await currentSessionUser();
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return user;
}
export async function setSessionCookie(token: string, request: Request) {
  const store = await cookies();
  const previous = store.get(SESSION_COOKIE)?.value;
  await auth.signOut(previous);
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" ||
      new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
  // Retire the original assessment-only identity cookie.
  store.delete("folio_demo_user");
}
export async function clearSessionCookie() {
  const store = await cookies();
  await auth.signOut(store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
  store.delete("folio_demo_user");
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
  if (origin) {
    const url = new URL(request.url);
    const host = request.headers.get("host") ?? url.host;
    const forwarded =
      process.env.VERCEL === "1"
        ? request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim()
        : undefined;
    const protocol =
      forwarded === "https" || forwarded === "http"
        ? `${forwarded}:`
        : url.protocol;
    let expected = "";
    try {
      if (/^[a-z0-9.\-:\[\]]+$/i.test(host))
        expected = new URL(`${protocol}//${host}`).origin;
    } catch {}
    if (origin !== expected)
      throw new AppError(403, "FORBIDDEN", "Requests must come from this app.");
  }
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
