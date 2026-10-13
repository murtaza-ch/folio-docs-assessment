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
    return json({
      share: await service.share(
        id,
        user.id,
        await parseBody(request, shareSchema),
      ),
    });
  });
}
