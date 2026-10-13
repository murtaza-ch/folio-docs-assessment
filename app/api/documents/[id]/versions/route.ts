import { currentUser, handle, json } from "@/lib/server-http";
import { collaboration } from "@/lib/server-collaboration";
import { idSchema } from "@/lib/validation";
type Context = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: Context) {
  return handle(async () =>
    json(
      await collaboration.versions(
        idSchema.parse((await context.params).id),
        (await currentUser()).id,
      ),
    ),
  );
}
