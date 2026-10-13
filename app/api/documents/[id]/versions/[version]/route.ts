import { currentUser, handle, json } from "@/lib/server-http";
import { collaboration } from "@/lib/server-collaboration";
import { versionNumberSchema } from "@/lib/collaboration-validation";
import { idSchema } from "@/lib/validation";
type Context = { params: Promise<{ id: string; version: string }> };
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: Context) {
  return handle(async () => {
    const params = await context.params;
    return json({
      snapshot: await collaboration.version(
        idSchema.parse(params.id),
        (await currentUser()).id,
        versionNumberSchema.parse(params.version),
      ),
    });
  });
}
