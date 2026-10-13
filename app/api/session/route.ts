import { cookies } from "next/headers";
import { repository } from "../../../lib/server-db";
import { AppError } from "../../../lib/server-service";
import {
  currentUser,
  handle,
  json,
  parseBody,
  sameOrigin,
  SESSION_COOKIE,
} from "../../../lib/server-http";
import { sessionSchema } from "../../../lib/validation";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () =>
    json({ user: await currentUser(), users: await repository.listUsers() }),
  );
}
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    const { userId } = await parseBody(request, sessionSchema);
    const user = await repository.getUser(userId);
    if (!user)
      throw new AppError(404, "USER_NOT_FOUND", "Demo account not found.");
    (await cookies()).set(SESSION_COOKIE, user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return json({ user, users: await repository.listUsers() });
  });
}
