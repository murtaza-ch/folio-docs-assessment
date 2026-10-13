import { z } from "zod";
import {
  currentUser,
  handle,
  json,
  parseBody,
  sameOrigin,
  service,
} from "@/lib/server-http";
import {
  heartbeat,
  leavePresence,
  presenceSnapshot,
} from "@/lib/server-presence";
import { idSchema } from "@/lib/validation";

export const runtime = "nodejs";
const heartbeatSchema = z
  .object({ tabId: z.uuid(), status: z.enum(["viewing", "editing"]) })
  .strict();
const leaveSchema = z.object({ tabId: z.uuid() }).strict();
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  return handle(async () => {
    const user = await currentUser();
    const id = idSchema.parse((await context.params).id);
    return json(await presenceSnapshot(await service.getDocument(id, user.id)));
  });
}
export async function POST(request: Request, context: Context) {
  return handle(async () => {
    sameOrigin(request);
    const user = await currentUser();
    const id = idSchema.parse((await context.params).id);
    const document = await service.getDocument(id, user.id);
    const body = await parseBody(request, heartbeatSchema);
    await heartbeat(document, user.id, body.tabId, body.status);
    return json(await presenceSnapshot(document));
  });
}
export async function DELETE(request: Request, context: Context) {
  return handle(async () => {
    sameOrigin(request);
    const user = await currentUser();
    const id = idSchema.parse((await context.params).id);
    await service.getDocument(id, user.id);
    const body = await parseBody(request, leaveSchema);
    await leavePresence(id, user.id, body.tabId);
    return json({ ok: true });
  });
}
