import { currentUser, handle, service } from "@/lib/server-http";
import { idSchema } from "@/lib/validation";
import { AppError } from "@/lib/server-service";
import {
  attachmentHeader,
  documentMarkdown,
  exportFilename,
} from "@/lib/document-export";
import { documentPdf } from "@/lib/server-pdf";

export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const user = await currentUser();
    const id = idSchema.parse((await context.params).id);
    const document = await service.getDocument(id, user.id);
    const format = new URL(request.url).searchParams.get("format");
    if (format !== "markdown" && format !== "pdf")
      throw new AppError(
        400,
        "INVALID_FORMAT",
        "Choose Markdown or PDF export.",
      );
    const filename = exportFilename(
      document.title,
      format === "pdf" ? "pdf" : "md",
    );
    const bytes =
      format === "pdf"
        ? await documentPdf(document.title, document.content)
        : documentMarkdown(document.content);
    return new Response(
      typeof bytes === "string" ? bytes : new Uint8Array(bytes),
      {
        headers: {
          "Content-Type":
            format === "pdf"
              ? "application/pdf"
              : "text/markdown; charset=utf-8",
          "Content-Disposition": attachmentHeader(filename),
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  });
}
