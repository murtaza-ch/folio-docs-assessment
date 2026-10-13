import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";

const cookieMock = vi.hoisted(() => ({
  values: new Map<string, string>(),
  writes: [] as Array<{ name: string; value: string; options: unknown }>,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieMock.values.has(name)
        ? { value: cookieMock.values.get(name) }
        : undefined,
    set: (name: string, value: string, options: unknown) => {
      cookieMock.values.set(name, value);
      cookieMock.writes.push({ name, value, options });
    },
    delete: (name: string) => cookieMock.values.delete(name),
  }),
}));
vi.mock("../lib/server-db", () => ({
  database: vi.fn(),
  repository: { getUser: vi.fn(), listUsers: vi.fn() },
}));
import {
  auth,
  authService,
  hashPassword,
  SESSION_SECONDS,
  signInSchema,
  signUpSchema,
  tokenDigest,
  trustedClientIp,
  verifyPassword,
  type AuthRepository,
  type AuthSession,
  type Credential,
} from "../lib/server-auth";
import {
  clearSessionCookie,
  currentSessionUser,
  currentUser,
  sameOrigin,
  setSessionCookie,
  SESSION_COOKIE,
} from "../lib/server-http";
import { POST as disabledImpersonation } from "../app/api/session/route";
import type { User } from "../lib/types";

const demo: User = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Alice Morgan",
  email: "alice@folio.demo",
  color: "green",
  initials: "AM",
};
let demoHash: string;
beforeAll(async () => {
  demoHash = await hashPassword("FolioDemo!2026");
}, 10000);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  cookieMock.values.clear();
  cookieMock.writes.length = 0;
});
function fakeAuthRepository() {
  const users = new Map([[demo.id, demo]]);
  const credentials = new Map<string, Credential>([
    [
      demo.email,
      {
        _id: demo.id,
        email: demo.email,
        passwordHash: demoHash,
        createdAt: new Date(0),
      },
    ],
  ]);
  const sessions = new Map<string, AuthSession>();
  const rates = new Map<string, number>();
  const repo: AuthRepository = {
    getCredential: vi.fn(async (email) => credentials.get(email) ?? null),
    getUser: vi.fn(async (id) => users.get(id) ?? null),
    createAccount: vi.fn(async (user, passwordHash) => {
      if (credentials.has(user.email))
        throw Object.assign(new Error("duplicate"), { code: 11000 });
      users.set(user.id, user);
      credentials.set(user.email, {
        _id: user.id,
        email: user.email,
        passwordHash,
        createdAt: new Date(),
      });
    }),
    createSession: vi.fn(async (session) => {
      sessions.set(session._id, session);
    }),
    getSession: vi.fn(async (digest) => sessions.get(digest) ?? null),
    deleteSession: vi.fn(async (digest) => {
      sessions.delete(digest);
    }),
    incrementRate: vi.fn(async (key) => {
      const count = (rates.get(key) ?? 0) + 1;
      rates.set(key, count);
      return count;
    }),
  };
  return { repo, users, credentials, sessions, rates };
}

describe("password hashing", () => {
  it("uses independent salts and verifies without storing the password", async () => {
    const a = await hashPassword("a sufficiently long password");
    const b = await hashPassword("a sufficiently long password");
    expect(a).not.toBe(b);
    expect(a).not.toContain("sufficiently");
    expect(a).toMatch(/^scrypt\$131072\$8\$1\$/);
    expect(await verifyPassword("a sufficiently long password", a)).toBe(true);
    expect(await verifyPassword("wrong password", a)).toBe(false);
  }, 10000);
  it("rejects malformed hashes and caller-supplied work factors", async () => {
    expect(
      await verifyPassword("FolioDemo!2026", "scrypt$1$8$1$invalid$invalid"),
    ).toBe(false);
    expect(await verifyPassword("FolioDemo!2026", "invalid")).toBe(false);
  });
  it("caps inputs and normalizes email without changing the password", () => {
    expect(
      signInSchema.parse({
        email: " Alice@Folio.Demo ",
        password: " keep spaces ",
      }),
    ).toEqual({ email: demo.email, password: " keep spaces " });
    expect(
      signUpSchema.safeParse({
        name: "Person",
        email: "x@test.com",
        password: "short",
      }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({
        name: "Person",
        email: "x@test.com",
        password: "a".repeat(129),
      }).success,
    ).toBe(false);
    expect(
      signInSchema.safeParse({ email: "not-an-email", password: "password" })
        .success,
    ).toBe(false);
    expect(
      signInSchema.safeParse({
        email: demo.email,
        password: "password",
        userId: demo.id,
      }).success,
    ).toBe(false);
  });
});

describe("persistent authentication service", () => {
  it("authenticates existing profiles and stores only a session digest", async () => {
    const { repo, sessions } = fakeAuthRepository();
    const service = authService(repo, () => new Date("2026-10-13T12:00:00Z"));
    const signed = await service.signIn(
      { email: "Alice@Folio.Demo", password: "FolioDemo!2026" },
      "ip",
    );
    expect(signed.user.id).toBe(demo.id);
    expect(signed.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sessions.has(signed.token)).toBe(false);
    const stored = sessions.get(tokenDigest(signed.token))!;
    expect(stored._id).toHaveLength(64);
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(
      SESSION_SECONDS * 1000,
    );
    expect(await service.userForToken(signed.token)).toEqual(demo);
  });
  it("returns the same error for missing accounts and wrong passwords", async () => {
    const service = authService(fakeAuthRepository().repo);
    await expect(
      service.signIn(
        { email: "absent@folio.demo", password: "wrong-password" },
        "ip",
      ),
    ).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect.",
    });
    await expect(
      service.signIn({ email: demo.email, password: "wrong-password" }, "ip"),
    ).rejects.toMatchObject({
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect.",
    });
  });
  it("creates a separate UUID profile and credentials without adopting the demo identity", async () => {
    const { repo, credentials, users } = fakeAuthRepository();
    const service = authService(repo);
    const signed = await service.signUp(
      {
        name: "New Person",
        email: " NEW@example.com ",
        password: "a good password",
      },
      "ip",
    );
    expect(signed.user.id).not.toBe(demo.id);
    expect(signed.user.email).toBe("new@example.com");
    expect(signed.user.initials).toBe("NP");
    expect(users.size).toBe(2);
    expect(credentials.get("new@example.com")?._id).toBe(signed.user.id);
    expect(JSON.stringify(signed.user)).not.toContain("passwordHash");
    expect(
      await verifyPassword(
        "a good password",
        credentials.get("new@example.com")!.passwordHash,
      ),
    ).toBe(true);
  });
  it("converts a unique-email race into a conflict without issuing a session", async () => {
    const { repo } = fakeAuthRepository();
    await expect(
      authService(repo).signUp(
        {
          name: "Other Alice",
          email: "ALICE@folio.demo",
          password: "new password",
        },
        "ip",
      ),
    ).rejects.toMatchObject({ status: 409, code: "EMAIL_IN_USE" });
    expect(repo.createSession).not.toHaveBeenCalled();
  });
  it("checks expiry explicitly even before MongoDB TTL cleanup", async () => {
    const { repo, sessions } = fakeAuthRepository();
    const token = randomBytes(32).toString("base64url");
    sessions.set(tokenDigest(token), {
      _id: tokenDigest(token),
      userId: demo.id,
      createdAt: new Date(0),
      expiresAt: new Date("2026-10-13T12:00:00Z"),
    });
    const service = authService(repo, () => new Date("2026-10-13T12:00:00Z"));
    expect(await service.userForToken(token)).toBeNull();
    expect(repo.getUser).not.toHaveBeenCalled();
  });
  it("rejects missing, malformed and unrecognized tokens", async () => {
    const { repo } = fakeAuthRepository();
    const service = authService(repo);
    expect(await service.userForToken(undefined)).toBeNull();
    expect(await service.userForToken(demo.id)).toBeNull();
    expect(repo.getSession).not.toHaveBeenCalled();
    expect(
      await service.userForToken(randomBytes(32).toString("base64url")),
    ).toBeNull();
  });
  it("revokes logout tokens server-side", async () => {
    const { repo, sessions } = fakeAuthRepository();
    const service = authService(repo);
    const signed = await service.signIn(
      { email: demo.email, password: "FolioDemo!2026" },
      "ip",
    );
    await service.signOut(signed.token);
    expect(repo.deleteSession).toHaveBeenCalledWith(tokenDigest(signed.token));
    expect(sessions.size).toBe(0);
    expect(await service.userForToken(signed.token)).toBeNull();
  });
  it("shares rate limits across service instances and resets only in a new window", async () => {
    const { repo, rates } = fakeAuthRepository();
    let now = new Date("2026-10-13T12:00:00Z");
    const one = authService(repo, () => now);
    const two = authService(repo, () => now);
    const window = Math.floor(now.getTime() / (15 * 60 * 1000));
    const key = `sign-in:email:${tokenDigest(demo.email)}:${window}`;
    rates.set(key, 11);
    await one.signIn({ email: demo.email, password: "FolioDemo!2026" }, "ip1");
    await expect(
      two.signIn({ email: demo.email, password: "FolioDemo!2026" }, "ip2"),
    ).rejects.toMatchObject({ status: 429 });
    expect([...rates.keys()].join()).not.toContain(demo.email);
    now = new Date("2026-10-13T12:15:00Z");
    expect(
      (
        await two.signIn(
          { email: demo.email, password: "FolioDemo!2026" },
          "ip2",
        )
      ).user.id,
    ).toBe(demo.id);
  });
  it("limits signup by IP before deriving a password", async () => {
    const { repo, rates } = fakeAuthRepository();
    const now = new Date("2026-10-13T12:00:00Z");
    const window = Math.floor(now.getTime() / (15 * 60 * 1000));
    rates.set(`sign-up:ip:${tokenDigest("ip")}:${window}`, 20);
    await expect(
      authService(repo, () => now).signUp(
        {
          name: "New Person",
          email: "new@example.com",
          password: "password-123",
        },
        "ip",
      ),
    ).rejects.toMatchObject({ status: 429 });
    expect(repo.createAccount).not.toHaveBeenCalled();
  });
});

describe("HTTP session boundaries", () => {
  it("never trusts userId impersonation or legacy demo cookies", async () => {
    const response = await disabledImpersonation();
    expect(response.status).toBe(403);
    cookieMock.values.set("folio_demo_user", demo.id);
    const lookup = vi.spyOn(auth, "userForToken").mockResolvedValue(null);
    expect(await currentSessionUser()).toBeNull();
    expect(lookup).toHaveBeenCalledWith(undefined);
    await expect(currentUser()).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });
  it("sets an opaque secure HTTP-only cookie and rotates an old session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    cookieMock.values.set(SESSION_COOKIE, "old-token");
    cookieMock.values.set("folio_demo_user", demo.id);
    const revoke = vi.spyOn(auth, "signOut").mockResolvedValue();
    await setSessionCookie(
      "new-opaque-token",
      new Request("http://internal/api/auth/sign-in"),
    );
    expect(revoke).toHaveBeenCalledWith("old-token");
    expect(cookieMock.writes[0]).toMatchObject({
      name: "folio_session",
      options: {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_SECONDS,
      },
    });
    expect(cookieMock.values.has("folio_demo_user")).toBe(false);
  });
  it("clears both the cookie and database session on logout", async () => {
    cookieMock.values.set(SESSION_COOKIE, "opaque-token");
    const revoke = vi.spyOn(auth, "signOut").mockResolvedValue();
    await clearSessionCookie();
    expect(revoke).toHaveBeenCalledWith("opaque-token");
    expect(cookieMock.values.has(SESSION_COOKIE)).toBe(false);
  });
  it("ignores forwarded headers outside the trusted deployment", () => {
    vi.stubEnv("VERCEL", "");
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.1" },
    });
    expect(trustedClientIp(request)).toBe("local-or-untrusted");
    vi.stubEnv("VERCEL", "1");
    expect(trustedClientIp(request)).toBe("203.0.113.1");
    expect(
      trustedClientIp(
        new Request("http://localhost", {
          headers: { "x-forwarded-for": "spoof" },
        }),
      ),
    ).toBe("local-or-untrusted");
  });
  it("rejects cross-site auth actions", () => {
    expect(() =>
      sameOrigin(
        new Request("https://folio.example/api/auth/sign-in", {
          headers: { origin: "https://malicious.example" },
        }),
      ),
    ).toThrow();
    expect(() =>
      sameOrigin(
        new Request("https://folio.example/api/auth/sign-in", {
          headers: { "sec-fetch-site": "cross-site" },
        }),
      ),
    ).toThrow();
  });
});


describe("origin checks with internal Next.js hostnames",()=>{
  it("accepts a same-origin request on the browser's actual loopback host",()=>{
    expect(()=>sameOrigin(new Request("http://localhost:3000/api/auth/sign-in",{headers:{host:"127.0.0.1:3000",origin:"http://127.0.0.1:3000","sec-fetch-site":"same-origin"}}))).not.toThrow();
  });
  it("rejects a different origin even if the internal URL matches that origin",()=>{
    expect(()=>sameOrigin(new Request("http://localhost:3000/api/auth/sign-in",{headers:{host:"127.0.0.1:3000",origin:"http://localhost:3000"}}))).toThrow();
  });
});
