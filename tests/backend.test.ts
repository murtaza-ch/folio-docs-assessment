import { describe, expect, it, vi } from "vitest";
import {
  documentService,
  type DocumentRepository,
} from "../lib/server-service";
import {
  EMPTY_DOCUMENT,
  type Document,
  type DocumentShare,
  type Role,
  type User,
} from "../lib/types";
import {
  createDocumentSchema,
  updateDocumentSchema,
  validRichText,
} from "../lib/validation";
import {
  importFile,
  markdownDocument,
  textDocument,
} from "../lib/server-import";

const owner: User = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Alice",
  email: "alice@folio.demo",
  color: "green",
  initials: "AM",
};
const guest: User = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Ben",
  email: "ben@folio.demo",
  color: "blue",
  initials: "BC",
};
const makeDocument = (role: Role = "owner", version = 1): Document => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  title: "Notes",
  ownerId: owner.id,
  owner,
  role,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  version,
  excerpt: "",
  wordCount: 0,
  shareCount: 0,
  content: EMPTY_DOCUMENT,
});
function fakeRepository(doc: Document | null = makeDocument()) {
  const repo: DocumentRepository = {
    listUsers: vi.fn(async () => [owner, guest]),
    getUser: vi.fn(
      async (id) => [owner, guest].find((user) => user.id === id) ?? null,
    ),
    listDocuments: vi.fn(async () => (doc ? [doc] : [])),
    getDocument: vi.fn(async () => doc),
    createDocument: vi.fn(async (_id, title, content) => ({
      ...makeDocument(),
      title,
      content,
    })),
    updateDocument: vi.fn(async () =>
      doc ? { ...doc, version: doc.version + 1 } : null,
    ),
    listShares: vi.fn(async () => []),
    upsertShare: vi.fn(
      async (_id, _owner, userId, role): Promise<DocumentShare> => ({
        userId,
        role,
        user: guest,
        createdAt: new Date(0).toISOString(),
      }),
    ),
    removeShare: vi.fn(async () => true),
  };
  return repo;
}

describe("document authorization and concurrency", () => {
  it("does not reveal inaccessible documents", async () => {
    const service = documentService(fakeRepository(null));
    await expect(
      service.getDocument("private", guest.id),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
  it("rejects viewer writes before reaching persistence", async () => {
    const repo = fakeRepository(makeDocument("viewer"));
    await expect(
      documentService(repo).updateDocument("notes", guest.id, {
        title: "Overwrite",
        version: 1,
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(repo.updateDocument).not.toHaveBeenCalled();
  });
  it.each(["owner", "editor"] as const)(
    "allows %s writes with the expected version",
    async (role) => {
      const repo = fakeRepository(makeDocument(role));
      const saved = await documentService(repo).updateDocument(
        "notes",
        owner.id,
        { title: "New title", version: 1 },
      );
      expect(saved.version).toBe(2);
      expect(repo.updateDocument).toHaveBeenCalledWith(
        "notes",
        owner.id,
        1,
        "New title",
        undefined,
      );
    },
  );
  it("rejects an already stale revision and returns the latest document", async () => {
    const repo = fakeRepository(makeDocument("editor", 7));
    await expect(
      documentService(repo).updateDocument("notes", guest.id, {
        title: "Old draft",
        version: 6,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "VERSION_CONFLICT",
      document: { version: 7 },
    });
    expect(repo.updateDocument).not.toHaveBeenCalled();
  });
  it("handles a competing save between read and atomic write without overwriting", async () => {
    const repo = fakeRepository(makeDocument("editor", 1));
    vi.mocked(repo.updateDocument).mockResolvedValue(null);
    vi.mocked(repo.getDocument)
      .mockResolvedValueOnce(makeDocument("editor", 1))
      .mockResolvedValueOnce(makeDocument("editor", 2));
    await expect(
      documentService(repo).updateDocument("notes", guest.id, {
        title: "Draft",
        version: 1,
      }),
    ).rejects.toMatchObject({ status: 409, document: { version: 2 } });
  });
  it("handles a permission downgrade between read and write", async () => {
    const repo = fakeRepository(makeDocument("editor"));
    vi.mocked(repo.updateDocument).mockResolvedValue(null);
    vi.mocked(repo.getDocument)
      .mockResolvedValueOnce(makeDocument("editor"))
      .mockResolvedValueOnce(makeDocument("viewer"));
    await expect(
      documentService(repo).updateDocument("notes", guest.id, {
        title: "Draft",
        version: 1,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("handles full revocation between read and write without exposing content", async () => {
    const repo = fakeRepository(makeDocument("editor"));
    vi.mocked(repo.updateDocument).mockResolvedValue(null);
    vi.mocked(repo.getDocument)
      .mockResolvedValueOnce(makeDocument("editor"))
      .mockResolvedValueOnce(null);
    await expect(
      documentService(repo).updateDocument("notes", guest.id, {
        title: "Draft",
        version: 1,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it.each(["editor", "viewer"] as const)(
    "prevents a %s from sharing or revoking",
    async (role) => {
      const repo = fakeRepository(makeDocument(role));
      const service = documentService(repo);
      await expect(
        service.share("notes", guest.id, { userId: guest.id, role: "editor" }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        service.revoke("notes", guest.id, guest.id),
      ).rejects.toMatchObject({ status: 403 });
      expect(repo.upsertShare).not.toHaveBeenCalled();
      expect(repo.removeShare).not.toHaveBeenCalled();
    },
  );
  it("lets the owner grant or update access and revoke it", async () => {
    const repo = fakeRepository();
    const service = documentService(repo);
    expect(
      (
        await service.share("notes", owner.id, {
          userId: guest.id,
          role: "viewer",
        })
      ).role,
    ).toBe("viewer");
    await service.revoke("notes", owner.id, guest.id);
    expect(repo.upsertShare).toHaveBeenCalledWith(
      "notes",
      owner.id,
      guest.id,
      "viewer",
    );
    expect(repo.removeShare).toHaveBeenCalledWith("notes", owner.id, guest.id);
  });
  it("prevents owner shares and sharing to missing accounts", async () => {
    const repo = fakeRepository();
    const service = documentService(repo);
    await expect(
      service.share("notes", owner.id, { userId: owner.id, role: "viewer" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.share("notes", owner.id, { userId: "missing", role: "viewer" }),
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.upsertShare).not.toHaveBeenCalled();
  });
});

describe("rich text validation", () => {
  it("accepts safe supported rich text", () => {
    expect(
      validRichText(
        markdownDocument(
          "# Notes\n\n**Bold** and *italic*\n\n- List item\n\n> A quote\n\n```ts\nconst answer = 42;\n```",
        ),
      ),
    ).toBe(true);
  });
  it.each([
    null,
    {},
    { type: "doc", content: [null] },
    { type: "doc", content: [1] },
    { type: "doc", content: [{ type: "script", text: "alert(1)" }] },
    { type: "doc", content: [{ type: "heading", attrs: { level: 99 } }] },
    {
      type: "doc",
      content: [{ type: "paragraph", attrs: { onclick: "alert(1)" } }],
    },
    { type: "doc", content: [{ type: "text", text: "Incorrect root child" }] },
  ])("rejects invalid shape without throwing: %j", (input) => {
    expect(() => validRichText(input)).not.toThrow();
    expect(validRichText(input)).toBe(false);
  });
  it("rejects executable link URLs", () => {
    expect(
      validRichText({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Click",
                marks: [
                  { type: "link", attrs: { href: "javascript:alert(1)" } },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });
  it("requires a version and disallows injected ownership or sharing fields", () => {
    expect(updateDocumentSchema.safeParse({ title: "Title" }).success).toBe(
      false,
    );
    expect(
      updateDocumentSchema.safeParse({
        version: 1,
        title: "Title",
        ownerId: guest.id,
      }).success,
    ).toBe(false);
    expect(
      createDocumentSchema.safeParse({
        title: "Title",
        shares: [{ userId: guest.id }],
      }).success,
    ).toBe(false);
  });
  it("rejects too-deep rich text", () => {
    let nested: unknown = { type: "paragraph" };
    for (let i = 0; i < 35; i++)
      nested = { type: "blockquote", content: [nested] };
    expect(validRichText({ type: "doc", content: [nested] })).toBe(false);
  });
});

describe("file import", () => {
  it("preserves Markdown headings, lists, inline marks and code", async () => {
    const value = await importFile(
      new File(
        ["### Notes\n\n1. **One**\n2. Two\n\n```js\nconst n = 1;\n```"],
        "team.md",
      ),
    );
    expect(value.title).toBe("team");
    expect(value.content.content.map((node) => node.type)).toEqual([
      "heading",
      "orderedList",
      "codeBlock",
    ]);
    expect(value.content.content[0].attrs?.level).toBe(3);
    expect(validRichText(value.content)).toBe(true);
  });
  it("keeps raw HTML and unsafe links as plain text", () => {
    const value = markdownDocument(
      "<script>alert(1)</script>\n\n[unsafe](javascript:alert) ",
    );
    expect(JSON.stringify(value)).toContain("<script>alert(1)</script>");
    expect(JSON.stringify(value)).not.toContain('"type":"link"');
  });
  it("preserves plain text rather than interpreting Markdown", () => {
    const value = textDocument("# literal\n\n**literal**");
    expect(value.content[0].type).toBe("paragraph");
    expect(value.content[0].content?.[0].text).toBe("# literal");
    expect(validRichText(value)).toBe(true);
  });
  it("rejects unsupported, empty, oversized and binary uploads", async () => {
    await expect(
      importFile(new File(["file"], "file.html")),
    ).rejects.toMatchObject({ status: 400 });
    await expect(importFile(new File([], "empty.txt"))).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      importFile(new File([new Uint8Array(1_048_577)], "large.txt")),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      importFile(new File(["hello\0world"], "binary.txt")),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      importFile(new File([new Uint8Array([0xff, 0xfe])], "bad.txt")),
    ).rejects.toMatchObject({ status: 400 });
  });
});
