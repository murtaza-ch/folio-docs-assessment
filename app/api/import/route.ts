import {
  currentUser,
  handle,
  json,
  sameOrigin,
  service,
} from "../../../lib/server-http";
import { AppError } from "../../../lib/server-service";
import { importFile } from "../../../lib/server-import";
import { MAX_FILE_BYTES } from "../../../lib/validation";
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    const user = await currentUser();
    if (
      Number(request.headers.get("content-length") ?? 0) >
      MAX_FILE_BYTES + 65536
    )
      throw new AppError(
        413,
        "FILE_TOO_LARGE",
        "Files must be 1 MB or smaller.",
      );
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new AppError(
        400,
        "INVALID_FILE",
        "Upload a file using multipart form data.",
      );
    }
    const file = form.get("file");
    if (!(file instanceof File))
      throw new AppError(400, "MISSING_FILE", "Choose a file to import.");
    return json(
      {
        document: await service.createDocument(user.id, await importFile(file)),
      },
      201,
    );
  });
}
