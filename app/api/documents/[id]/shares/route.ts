import { database, type StoredUser } from "../../../../../lib/server-db";
import { AppError } from "../../../../../lib/server-service";
import {
  currentUser,
  handle,
  json,
  parseBody,
  sameOrigin,
  service,
} from "../../../../../lib/server-http";
import { idSchema, shareSchema } from "../../../../../lib/validation";
type Context = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: Context) {
  return handle(async () => {
    const id = idSchema.parse((await context.params).id);
    return json(await service.shares(id, (await currentUser()).id));
  });
}
export async function POST(request: Request, context: Context) {
  return handle(async () => {
    sameOrigin(request);
    const id = idSchema.parse((await context.params).id);
    const user = await currentUser();
    const doc = await service.getDocument(id, user.id);
    if (doc.role !== "owner")
      throw new AppError(403, "FORBIDDEN", "Only the owner can manage access.");
    const value = await parseBody(request, shareSchema);
    const recipient =
      value.userId ??
      (
        await (
          await database()
        )
          .collection<StoredUser>("folio_users")
          .findOne({ email: value.email })
      )?._id;
    if (!recipient)
      throw new AppError(
        404,
        "USER_NOT_FOUND",
        "No account is registered with that email yet.",
      );
    return json({
      share: await service.share(id, user.id, {
        userId: recipient,
        role: value.role,
      }),
    });
  });
}
