// Run against a local app connected to a disposable assessment database.
import assert from "node:assert/strict";
const base = process.env.APP_URL || "http://localhost:3000";
const cookies = new Map();
async function request(
  path,
  { user, status = 200, method = "GET", body, form } = {},
) {
  const headers = {};
  if (user) headers.Cookie = cookies.get(user);
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      `${method} ${path}: expected JSON, received HTTP ${response.status}`,
    );
  const result = await response.json();
  assert.equal(
    response.status,
    status,
    `${method} ${path}: ${JSON.stringify(result)}`,
  );
  return { result, response };
}
const testRecords = [];
try {
  const { result: session } = await request("/api/session");
  assert.equal(session.users.length, 3);
  const [owner, editor, viewer] = session.users;
  for (const user of session.users) {
    const { response } = await request("/api/session", {
      method: "POST",
      body: { userId: user.id },
    });
    cookies.set(user.id, response.headers.get("set-cookie").split(";")[0]);
  }
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
  const { result: opened } = await request(`/api/documents/${id}`, {
    user: editor.id,
  });
  assert.deepEqual(opened.document.content, content);
  assert.equal(opened.document.role, "editor");
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
  await request(`/api/documents/${id}/shares`, {
    user: editor.id,
    method: "POST",
    status: 403,
    body: { userId: viewer.id, role: "editor" },
  });
  await request(`/api/documents/${id}/shares/${editor.id}`, {
    user: owner.id,
    method: "DELETE",
  });
  await request(`/api/documents/${id}`, { user: editor.id, status: 404 });
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
  const { result: listing } = await request("/api/documents", {
    user: viewer.id,
  });
  assert(
    listing.documents.some((doc) => doc.id === id && doc.role === "viewer"),
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
  console.log(
    "PASS: rich-text persistence, create/rename, editor/viewer access, unauthorized denial, stale-save rejection, share revocation, Markdown import, invalid file rejection.",
  );
} finally {
  // Delete only documents created by this run, never seed or pre-existing records.
  const { default: dotenv } = await import("dotenv");
  dotenv.config({ path: ".env.local", quiet: true });
  if (process.env.MONGODB_URI && testRecords.length) {
    const { MongoClient } = await import("mongodb");
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
      await client.connect();
      const removed = await client
        .db(process.env.MONGODB_DB || "drive-test")
        .collection("folio_documents")
        .deleteMany({ _id: { $in: testRecords } });
      console.log(
        `Cleaned up ${removed.deletedCount} documents created by this test run.`,
      );
    } finally {
      await client.close();
    }
  } else if (testRecords.length)
    console.log("Test records created:", testRecords.join(", "));
}
