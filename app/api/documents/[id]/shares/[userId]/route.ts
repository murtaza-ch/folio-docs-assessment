import {
  currentUser,
  handle,
  json,
  sameOrigin,
  service,
} from "../../../../../../lib/server-http";
import { idSchema } from "../../../../../../lib/validation";
type Context = { params: Promise<{ id: string; userId: string }> };
export async function DELETE(request: Request, context: Context) {
  return handle(async () => {
    sameOrigin(request);
    const params = await context.params;
    await service.revoke(
      idSchema.parse(params.id),
      (await currentUser()).id,
      idSchema.parse(params.userId),
    );
    return json({ success: true });
  });
}
