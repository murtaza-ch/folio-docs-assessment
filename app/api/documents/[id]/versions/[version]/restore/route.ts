import {
  currentUser,
  handle,
  json,
  parseBody,
  sameOrigin,
} from "@/lib/server-http";
import { collaboration } from "@/lib/server-collaboration";
import {
  restoreVersionSchema,
  versionNumberSchema,
} from "@/lib/collaboration-validation";
import { idSchema } from "@/lib/validation";
type Context = { params: Promise<{ id: string; version: string }> };
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: Context) {
  return handle(async () => {
    sameOrigin(request);
    const params = await context.params;
    const id = idSchema.parse(params.id),
      version = versionNumberSchema.parse(params.version);
    const user = await currentUser();
    const value = await parseBody(request, restoreVersionSchema);
    return json({
      document: await collaboration.restore(
        id,
        user.id,
        version,
        value.version,
      ),
    });
  });
}
