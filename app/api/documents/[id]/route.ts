import {
  currentUser,
  handle,
  json,
  parseBody,
  sameOrigin,
  service,
} from "../../../../lib/server-http";
import { idSchema, updateDocumentSchema } from "../../../../lib/validation";
type Context = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: Context) {
  return handle(async () => {
    const id = idSchema.parse((await context.params).id);
    return json({
      document: await service.getDocument(id, (await currentUser()).id),
    });
  });
}
export async function PATCH(request: Request, context: Context) {
  return handle(async () => {
    sameOrigin(request);
    const id = idSchema.parse((await context.params).id);
    const user = await currentUser();
    const value = await parseBody(request, updateDocumentSchema);
    return json({ document: await service.updateDocument(id, user.id, value) });
  });
}
