import { describe, expect, it, vi } from "vitest";
import {
  collaborationService,
  type CollaborationRepository,
  type StoredComment,
} from "../lib/server-collaboration";
import { AppError } from "../lib/server-service";
import {
  createCommentSchema,
  updateCommentSchema,
} from "../lib/collaboration-validation";
import {
  EMPTY_DOCUMENT,
  type Document,
  type Role,
  type User,
} from "../lib/types";

const alice: User = {
  id: "alice",
  name: "Alice",
  email: "alice@test.dev",
  color: "green",
  initials: "AL",
};
const ben: User = {
  id: "ben",
  name: "Ben",
  email: "ben@test.dev",
  color: "blue",
  initials: "BE",
};
const now = new Date("2026-10-13T12:00:00Z");
const makeDoc = (role: Role): Document => ({
  id: "doc",
  title: "Current title",
  ownerId: alice.id,
  owner: alice,
  role,
  version: 3,
  content: EMPTY_DOCUMENT,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  excerpt: "",
  wordCount: 0,
  shareCount: 1,
});
const makeComment = (authorId = ben.id): StoredComment => ({
  _id: "comment",
  documentId: "doc",
  body: "A suggestion",
  authorId,
  createdAt: now,
});
function fixture(role: Role = "owner", authorId = ben.id) {
  const doc = makeDoc(role),
    comment = makeComment(authorId);
  const repo: CollaborationRepository = {
    listComments: vi.fn(async () => [comment]),
    getComment: vi.fn(async () => comment),
    createComment: vi.fn(async (row) => row),
    updateComment: vi.fn(async (_docId, _commentId, fields) => ({
      ...comment,
      ...fields,
    })),
    readHistory: vi.fn(async () => ({
      updatedById: ben.id,
      history: [
        {
          version: 2,
          title: "Previous title",
          content: EMPTY_DOCUMENT,
          createdAt: now,
          authorId: alice.id,
        },
      ],
    })),
  };
  const docs = {
    getDocument: vi.fn(async () => doc),
    updateDocument: vi.fn(
      async (
        _id: string,
        _userId: string,
        value: {
          version: number;
          title?: string;
          content?: typeof EMPTY_DOCUMENT;
        },
      ) => ({ ...doc, ...value, version: value.version + 1 }),
    ),
  };
  const getUser = vi.fn(
    async (id: string) => [alice, ben].find((user) => user.id === id) ?? null,
  );
  return { repo, docs, service: collaborationService(repo, docs, getUser) };
}

describe("comment permissions and lifecycle", () => {
  it.each(["owner", "editor", "viewer"] as const)(
    "allows a document %s to read and post comments",
    async (role) => {
      const { service, repo, docs } = fixture(role);
      expect((await service.comments("doc", ben.id))[0].author).toEqual(ben);
      const created = await service.comment("doc", ben.id, "Feedback");
      expect(created.body).toBe("Feedback");
      expect(docs.getDocument).toHaveBeenCalledWith("doc", ben.id);
      expect(repo.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: "doc",
          authorId: ben.id,
          body: "Feedback",
        }),
      );
    },
  );
  it("checks document access before exposing comments or history", async () => {
    const { service, repo, docs } = fixture();
    docs.getDocument.mockRejectedValue(
      new AppError(404, "NOT_FOUND", "Unavailable"),
    );
    await expect(service.comments("private", ben.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.comment("private", ben.id, "Feedback"),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.updateComment("private", "comment", ben.id, { body: "Edit" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.deleteComment("private", "comment", ben.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(service.versions("private", ben.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.version("private", ben.id, 2)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      service.restore("private", ben.id, 2, 3),
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.listComments).not.toHaveBeenCalled();
    expect(repo.getComment).not.toHaveBeenCalled();
    expect(repo.createComment).not.toHaveBeenCalled();
    expect(repo.readHistory).not.toHaveBeenCalled();
  });
  it("allows a viewer to edit, resolve, reopen, and delete their own comment", async () => {
    const { service, repo } = fixture("viewer");
    expect(
      (
        await service.updateComment("doc", "comment", ben.id, {
          body: "Updated",
        })
      ).body,
    ).toBe("Updated");
    expect(
      (
        await service.updateComment("doc", "comment", ben.id, {
          resolved: true,
        })
      ).resolvedBy,
    ).toEqual(ben);
    expect(
      (
        await service.updateComment("doc", "comment", ben.id, {
          resolved: false,
        })
      ).resolvedAt,
    ).toBeUndefined();
    await service.deleteComment("doc", "comment", ben.id);
    expect(repo.updateComment).toHaveBeenLastCalledWith(
      "doc",
      "comment",
      expect.objectContaining({ deletedAt: expect.any(Date) }),
    );
  });
  it("prevents viewers from modifying other people's comments", async () => {
    const { service, repo } = fixture("viewer", alice.id);
    await expect(
      service.updateComment("doc", "comment", ben.id, { body: "Overwrite" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.updateComment("doc", "comment", ben.id, { resolved: true }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.deleteComment("doc", "comment", ben.id),
    ).rejects.toMatchObject({ status: 403 });
    expect(repo.updateComment).not.toHaveBeenCalled();
  });
  it("allows editors to resolve another author's comment, without editing or deleting it", async () => {
    const { service, repo } = fixture("editor", alice.id);
    await service.updateComment("doc", "comment", ben.id, { resolved: true });
    await expect(
      service.updateComment("doc", "comment", ben.id, {
        body: "Overwrite",
        resolved: true,
      }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.deleteComment("doc", "comment", ben.id),
    ).rejects.toMatchObject({ status: 403 });
    expect(repo.updateComment).toHaveBeenCalledTimes(1);
  });
  it("allows document owners to moderate another author's comment", async () => {
    const { service } = fixture("owner");
    await service.updateComment("doc", "comment", alice.id, {
      body: "Moderated",
      resolved: true,
    });
    await service.deleteComment("doc", "comment", alice.id);
  });
  it("does not expose or revive soft-deleted comments", async () => {
    const { service, repo } = fixture();
    const deleted = { ...makeComment(), deletedAt: now };
    vi.mocked(repo.listComments).mockResolvedValue([deleted]);
    vi.mocked(repo.getComment).mockResolvedValue(deleted);
    expect(await service.comments("doc", alice.id)).toEqual([]);
    await expect(
      service.updateComment("doc", "comment", alice.id, { body: "Revive" }),
    ).rejects.toMatchObject({ status: 404 });
    expect(repo.updateComment).not.toHaveBeenCalled();
  });
  it("validates blank, oversized, and injected comment payloads", () => {
    expect(createCommentSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(
      createCommentSchema.safeParse({ body: "a".repeat(2001) }).success,
    ).toBe(false);
    expect(
      createCommentSchema.safeParse({ body: "Hello", authorId: alice.id })
        .success,
    ).toBe(false);
    expect(updateCommentSchema.safeParse({}).success).toBe(false);
    expect(updateCommentSchema.safeParse({ deletedAt: now }).success).toBe(
      false,
    );
    expect(createCommentSchema.parse({ body: "  A comment  " }).body).toBe(
      "A comment",
    );
  });
});

describe("version history and restore", () => {
  it("includes current and prior versions with their correct authors", async () => {
    const { service } = fixture("viewer");
    const result = await service.versions("doc", ben.id);
    expect(result.currentVersion).toBe(3);
    expect(
      result.versions.map((version) => [version.version, version.author.id]),
    ).toEqual([
      [3, ben.id],
      [2, alice.id],
    ]);
    expect(result.versions[0]).not.toHaveProperty("content");
    expect((await service.version("doc", ben.id, 2)).title).toBe(
      "Previous title",
    );
  });
  it("keeps current content, author, and version coherent when a save occurs after the access check", async () => {
    const { service, repo } = fixture("viewer");
    // The access check read version 3. Another editor saved version 4 before the history read.
    vi.mocked(repo.readHistory).mockResolvedValue({
      history: [
        {
          version: 3,
          title: "Current title",
          content: EMPTY_DOCUMENT,
          createdAt: now,
          authorId: ben.id,
        },
      ],
      updatedById: alice.id,
      current: {
        version: 4,
        title: "A newer save",
        content: EMPTY_DOCUMENT,
        createdAt: now,
        authorId: alice.id,
      },
    });
    const result = await service.versions("doc", ben.id);
    expect(result.currentVersion).toBe(4);
    expect(
      result.versions.map((version) => [
        version.version,
        version.title,
        version.author.id,
      ]),
    ).toEqual([
      [4, "A newer save", alice.id],
      [3, "Current title", ben.id],
    ]);
    const snapshot = await service.version("doc", ben.id, 4);
    expect(snapshot).toMatchObject({
      version: 4,
      title: "A newer save",
      author: alice,
    });
  });
  it("shows a current baseline for a document that predates history", async () => {
    const { service, repo } = fixture();
    vi.mocked(repo.readHistory).mockResolvedValue({ history: [] });
    expect((await service.versions("doc", alice.id)).versions).toEqual([
      expect.objectContaining({
        version: 3,
        title: "Current title",
        author: alice,
      }),
    ]);
  });
  it("does not allow viewers to restore documents", async () => {
    const { service, docs, repo } = fixture("viewer");
    await expect(service.restore("doc", ben.id, 2, 3)).rejects.toMatchObject({
      status: 403,
    });
    expect(docs.updateDocument).not.toHaveBeenCalled();
    expect(repo.readHistory).not.toHaveBeenCalled();
  });
  it.each(["owner", "editor"] as const)(
    "allows a %s to restore through the existing optimistic-save service",
    async (role) => {
      const { service, docs } = fixture(role);
      const restored = await service.restore("doc", ben.id, 2, 3);
      expect(restored.version).toBe(4);
      expect(docs.updateDocument).toHaveBeenCalledWith("doc", ben.id, {
        version: 3,
        title: "Previous title",
        content: EMPTY_DOCUMENT,
      });
    },
  );
  it("propagates competing-save conflicts without another write", async () => {
    const { service, docs } = fixture("editor");
    docs.updateDocument.mockRejectedValue(
      new AppError(
        409,
        "VERSION_CONFLICT",
        "Changed elsewhere",
        makeDoc("editor"),
      ),
    );
    await expect(service.restore("doc", ben.id, 2, 2)).rejects.toMatchObject({
      status: 409,
      code: "VERSION_CONFLICT",
    });
    expect(docs.updateDocument).toHaveBeenCalledTimes(1);
  });
  it("rejects versions outside the retained history", async () => {
    const { service, docs } = fixture();
    await expect(service.version("doc", alice.id, 1)).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.restore("doc", alice.id, 1, 3)).rejects.toMatchObject({
      status: 404,
    });
    expect(docs.updateDocument).not.toHaveBeenCalled();
  });
});
