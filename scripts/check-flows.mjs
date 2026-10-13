// Run against a local or deployed app using the same configured MongoDB.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.APP_URL || "http://localhost:3000";
const password = "FolioDemo!2026";
const cookies = new Map();
const testRecords = [];
let newUserId;
async function request(
  path,
  { user, status = 200, method = "GET", body, form, rawCookie } = {},
) {
  const headers = {};
  if (rawCookie || user) headers.Cookie = rawCookie || cookies.get(user);
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      `${method} ${path}: expected JSON, HTTP ${response.status}`,
    );
  const result = await response.json();
  assert.equal(
    response.status,
    status,
    `${method} ${path}: ${JSON.stringify(result)}`,
  );
  return { result, response };
}
try {
  const { result: anonymous } = await request("/api/session");
  assert.equal(anonymous.user, null);
  await request("/api/documents", { status: 401 });
  await request("/api/documents", {
    status: 401,
    rawCookie: "folio_demo_user=11111111-1111-4111-8111-111111111111",
  });
  await request("/api/session", {
    method: "POST",
    status: 403,
    body: { userId: anonymous.users[0].id },
  });
  const signed = [];
  for (const name of ["alice", "ben", "clara"]) {
    const { result, response } = await request("/api/auth/sign-in", {
      method: "POST",
      body: { email: `${name}@folio.demo`, password },
    });
    const cookie =
      response.headers
        .get("set-cookie")
        .split(", ")
        .find((x) => x.startsWith("folio_session="))
        ?.split(";")[0] || response.headers.get("set-cookie").split(";")[0];
    cookies.set(result.user.id, cookie);
    signed.push(result.user);
  }
  const [owner, editor, viewer] = signed;
  const { result: session } = await request("/api/session", { user: owner.id });
  assert.equal(session.user.id, owner.id);
  const email = `flow-${Date.now()}@example.com`;
  const { result: signup, response: registered } = await request(
    "/api/auth/sign-up",
    {
      method: "POST",
      status: 201,
      body: { name: "Flow Reviewer", email, password: "TestFlow!2026" },
    },
  );
  newUserId = signup.user.id;
  cookies.set(
    newUserId,
    registered.headers
      .get("set-cookie")
      .split(", ")
      .find((x) => x.startsWith("folio_session="))
      ?.split(";")[0] || registered.headers.get("set-cookie").split(";")[0],
  );
  assert.deepEqual(
    (await request("/api/documents", { user: newUserId })).result.documents,
    [],
  );
  await request("/api/auth/sign-up", {
    method: "POST",
    status: 409,
    body: { name: "Duplicate", email, password: "TestFlow!2026" },
  });
  const title = `Flow check ${Date.now()}`;
  const content = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "A verified document" }],
      },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Formatting survives a reopen.",
            marks: [{ type: "bold" }, { type: "underline" }],
          },
        ],
      },
    ],
  };
  const { result: created } = await request("/api/documents", {
    user: owner.id,
    method: "POST",
    status: 201,
    body: { title, content },
  });
  const id = created.document.id;
  testRecords.push(id);
  await request(`/api/documents/${id}`, { user: editor.id, status: 404 });
  await request(`/api/documents/${id}/shares`, {
    user: owner.id,
    method: "POST",
    body: { userId: editor.id, role: "editor" },
  });
  await request(`/api/documents/${id}/shares`, {
    user: owner.id,
    method: "POST",
    body: { userId: viewer.id, role: "viewer" },
  });
  await request(`/api/documents/${id}/shares`, {
    user: owner.id,
    method: "POST",
    body: { email, role: "viewer" },
  });
  assert.equal(
    (await request(`/api/documents/${id}`, { user: newUserId })).result.document
      .role,
    "viewer",
  );
  const { result: opened } = await request(`/api/documents/${id}`, {
    user: editor.id,
  });
  assert.deepEqual(opened.document.content, content);
  await request(`/api/documents/${id}`, {
    user: viewer.id,
    method: "PATCH",
    status: 403,
    body: { title: "Should fail", version: opened.document.version },
  });
  const { result: renamed } = await request(`/api/documents/${id}`, {
    user: editor.id,
    method: "PATCH",
    body: { title: title + " renamed", version: opened.document.version },
  });
  assert.equal(renamed.document.version, opened.document.version + 1);
  await request(`/api/documents/${id}`, {
    user: owner.id,
    method: "PATCH",
    status: 409,
    body: { title: "Stale overwrite", version: opened.document.version },
  });
  const { result: history } = await request(`/api/documents/${id}/versions`, {
    user: viewer.id,
  });
  assert(history.versions.some((v) => v.version === 1 && v.title === title));
  await request(`/api/documents/${id}/versions/1/restore`, {
    user: viewer.id,
    method: "POST",
    status: 403,
    body: { version: renamed.document.version },
  });
  const { result: restored } = await request(
    `/api/documents/${id}/versions/1/restore`,
    {
      user: owner.id,
      method: "POST",
      body: { version: renamed.document.version },
    },
  );
  assert.equal(restored.document.title, title);
  assert.equal(restored.document.version, 3);
  const { result: comment } = await request(`/api/documents/${id}/comments`, {
    user: viewer.id,
    method: "POST",
    status: 201,
    body: { body: "Please review the introduction." },
  });
  await request(`/api/documents/${id}/comments/${comment.comment.id}`, {
    user: newUserId,
    method: "PATCH",
    status: 403,
    body: { body: "Cannot edit someone else comment" },
  });
  const { result: resolved } = await request(
    `/api/documents/${id}/comments/${comment.comment.id}`,
    { user: editor.id, method: "PATCH", body: { resolved: true } },
  );
  assert(resolved.comment.resolvedAt);
  await request(`/api/documents/${id}/comments/${comment.comment.id}`, {
    user: viewer.id,
    method: "PATCH",
    body: { resolved: false },
  });
  const tabId = randomUUID();
  const { result: presence } = await request(`/api/documents/${id}/presence`, {
    user: editor.id,
    method: "POST",
    body: { tabId, status: "editing" },
  });
  assert(
    presence.participants.some(
      (p) => p.user.id === editor.id && p.status === "editing",
    ),
  );
  await request(`/api/documents/${id}/presence`, {
    user: viewer.id,
    method: "POST",
    status: 403,
    body: { tabId: randomUUID(), status: "editing" },
  });
  await request(`/api/documents/${id}/presence`, {
    user: editor.id,
    method: "DELETE",
    body: { tabId },
  });
  for (const format of ["markdown", "pdf"]) {
    const response = await fetch(
      base + `/api/documents/${id}/export?format=${format}`,
      { headers: { Cookie: cookies.get(viewer.id) } },
    );
    assert.equal(response.status, 200);
    assert(response.headers.get("content-disposition").includes("attachment"));
    const bytes = new Uint8Array(await response.arrayBuffer());
    const text = new TextDecoder().decode(bytes);
    if (format === "pdf") assert(text.startsWith("%PDF-"));
    else {
      assert(text.includes("## A verified document"));
      assert(text.includes("Formatting survives a reopen"));
    }
  }
  await request(`/api/documents/${id}/shares/${editor.id}`, {
    user: owner.id,
    method: "DELETE",
  });
  await request(`/api/documents/${id}`, { user: editor.id, status: 404 });
  await request(`/api/documents/${id}/versions`, {
    user: editor.id,
    status: 404,
  });
  await request(`/api/documents/${id}/comments`, {
    user: editor.id,
    status: 404,
  });
  const form = new FormData();
  form.set(
    "file",
    new File(
      ["# Imported heading\n\n**Bold** and _italic_\n\n- One\n- Two"],
      "check.md",
      { type: "text/markdown" },
    ),
  );
  const { result: imported } = await request("/api/import", {
    user: owner.id,
    method: "POST",
    form,
    status: 201,
  });
  testRecords.push(imported.document.id);
  assert(
    imported.document.content.content.some((node) => node.type === "heading"),
  );
  const invalid = new FormData();
  invalid.set(
    "file",
    new File(["unsupported"], "check.pdf", { type: "application/pdf" }),
  );
  await request("/api/import", {
    user: owner.id,
    method: "POST",
    form: invalid,
    status: 400,
  });
  await request("/api/auth/sign-out", { user: newUserId, method: "POST" });
  await request("/api/documents", { user: newUserId, status: 401 });
  for (const user of signed)
    await request("/api/auth/sign-out", { user: user.id, method: "POST" });
  console.log(
    "PASS: auth/signup/duplicate/logout, legacy cookie rejection, rich-text persistence, email invitations, role checks, atomic history/restore, comments/resolution, presence, PDF/Markdown, import, conflicts and revocation.",
  );
} finally {
  const { default: dotenv } = await import("dotenv");
  dotenv.config({ path: ".env.local", quiet: true });
  if (process.env.MONGODB_URI) {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
      await client.connect();
      const db = client.db(process.env.MONGODB_DB || "drive-test");
      if (testRecords.length) {
        await db
          .collection("folio_documents")
          .deleteMany({ _id: { $in: testRecords } });
        await db
          .collection("folio_comments")
          .deleteMany({ documentId: { $in: testRecords } });
        await db
          .collection("folio_presence")
          .deleteMany({ documentId: { $in: testRecords } });
      }
      if (newUserId) {
        await db.collection("folio_credentials").deleteOne({ _id: newUserId });
        await db.collection("folio_users").deleteOne({ _id: newUserId });
        await db.collection("folio_sessions").deleteMany({ userId: newUserId });
      }
      console.log("Cleaned up this run's temporary accounts and documents.");
    } finally {
      await client.close();
    }
  }
}
