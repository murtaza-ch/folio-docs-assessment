import {
  currentUser,
  handle,
  json,
  parseBody,
  sameOrigin,
  service,
} from "../../../lib/server-http";
import { createDocumentSchema } from "../../../lib/validation";
export const dynamic = "force-dynamic";
export async function GET() {
  return handle(async () =>
    json({ documents: await service.listDocuments((await currentUser()).id) }),
  );
}
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    const user = await currentUser();
    const value = await parseBody(request, createDocumentSchema);
    return json(
      { document: await service.createDocument(user.id, value) },
      201,
    );
  });
}
