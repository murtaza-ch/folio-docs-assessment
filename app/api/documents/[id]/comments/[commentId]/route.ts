import {
  currentUser,
  handle,
  json,
  parseBody,
  sameOrigin,
} from "@/lib/server-http";
import { collaboration } from "@/lib/server-collaboration";
import { updateCommentSchema } from "@/lib/collaboration-validation";
import { idSchema } from "@/lib/validation";
type Context = { params: Promise<{ id: string; commentId: string }> };
export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context: Context) {
  return handle(async () => {
    sameOrigin(request);
    const params = await context.params;
    const id = idSchema.parse(params.id),
      commentId = idSchema.parse(params.commentId);
    const user = await currentUser();
    const value = await parseBody(request, updateCommentSchema);
    return json({
      comment: await collaboration.updateComment(id, commentId, user.id, value),
    });
  });
}
export async function DELETE(request: Request, context: Context) {
  return handle(async () => {
    sameOrigin(request);
    const params = await context.params;
    await collaboration.deleteComment(
      idSchema.parse(params.id),
      idSchema.parse(params.commentId),
      (await currentUser()).id,
    );
    return json({ ok: true });
  });
}
