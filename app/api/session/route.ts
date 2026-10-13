import { repository } from "../../../lib/server-db";
import { AppError } from "../../../lib/server-service";
import { currentSessionUser, handle, json } from "../../../lib/server-http";
import { DEMO_PROFILE_IDS } from "../../../lib/server-auth";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () => {
    const users = (
      await Promise.all(DEMO_PROFILE_IDS.map((id) => repository.getUser(id)))
    ).filter((user) => user !== null);
    return json({ user: await currentSessionUser(), users });
  });
}
export async function POST() {
  return handle(async () => {
    throw new AppError(
      403,
      "IMPERSONATION_DISABLED",
      "Sign in with an email and password to select an account.",
    );
  });
}
