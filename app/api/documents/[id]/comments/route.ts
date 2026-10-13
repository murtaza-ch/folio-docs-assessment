import {
  currentUser,
  handle,
  json,
  parseBody,
  sameOrigin,
} from "@/lib/server-http";
import { collaboration } from "@/lib/server-collaboration";
import { createCommentSchema } from "@/lib/collaboration-validation";
import { idSchema } from "@/lib/validation";
type Context = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: Context) {
  return handle(async () =>
    json({
      comments: await collaboration.comments(
        idSchema.parse((await context.params).id),
        (await currentUser()).id,
      ),
    }),
  );
}
export async function POST(request: Request, context: Context) {
  return handle(async () => {
    sameOrigin(request);
    const id = idSchema.parse((await context.params).id);
    const user = await currentUser();
    const value = await parseBody(request, createCommentSchema);
    return json(
      { comment: await collaboration.comment(id, user.id, value.body) },
      201,
    );
  });
}
