import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";
import { database, repository, type StoredUser } from "./server-db";
import { AppError } from "./server-service";
import type { User } from "./types";

export const SESSION_SECONDS = 60 * 60 * 24 * 7;
export const DEMO_PASSWORD = "FolioDemo!2026";
export const DEMO_PROFILE_IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
const SCRYPT_N = 131072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const MAX_MEMORY = 256 * 1024 * 1024;
const RATE_WINDOW = 15 * 60 * 1000;
export const signInSchema = z
  .object({
    email: z
      .string()
      .trim()
      .max(254)
      .email()
      .transform((email) => email.toLowerCase()),
    password: z.string().min(1).max(128),
  })
  .strict();
export const signUpSchema = signInSchema
  .extend({
    name: z.string().trim().min(2).max(80),
    password: z
      .string()
      .min(8, "Use at least 8 characters for your password.")
      .max(128),
  })
  .strict();

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      KEY_BYTES,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await derive(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
// Unknown accounts still perform the same expensive derivation and comparison.
const DUMMY_HASH = `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${Buffer.alloc(SALT_BYTES, 1).toString("base64url")}$${Buffer.alloc(KEY_BYTES).toString("base64url")}`;
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const [algorithm, n, r, p, saltText, keyText, extra] = encoded.split("$");
  const valid =
    algorithm === "scrypt" &&
    n === String(SCRYPT_N) &&
    r === String(SCRYPT_R) &&
    p === String(SCRYPT_P) &&
    !extra &&
    /^[A-Za-z0-9_-]{22}$/.test(saltText ?? "") &&
    /^[A-Za-z0-9_-]{86}$/.test(keyText ?? "");
  if (!valid) {
    await derive(password, Buffer.alloc(SALT_BYTES, 1));
    return false;
  }
  const key = await derive(password, Buffer.from(saltText, "base64url"));
  return timingSafeEqual(key, Buffer.from(keyText, "base64url"));
}
export function tokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export function trustedClientIp(request: Request): string {
  // Vercel overwrites X-Forwarded-For at its edge. Outside Vercel, supplied
  // forwarding headers are untrusted and all requests share one local bucket.
  if (process.env.VERCEL === "1") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip && isIP(ip)) return ip;
  }
  return "local-or-untrusted";
}
export interface Credential {
  _id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}
export interface AuthSession {
  _id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}
interface AuthRate {
  _id: string;
  count: number;
  expiresAt: Date;
}
export interface AuthRepository {
  getCredential(email: string): Promise<Credential | null>;
  getUser(id: string): Promise<User | null>;
  createAccount(user: User, passwordHash: string): Promise<void>;
  createSession(session: AuthSession): Promise<void>;
  getSession(digest: string, now: Date): Promise<AuthSession | null>;
  deleteSession(digest: string): Promise<void>;
  incrementRate(key: string, expiresAt: Date): Promise<number>;
}
export const authRepository: AuthRepository = {
  async getCredential(email) {
    return (await database())
      .collection<Credential>("folio_credentials")
      .findOne({ email });
  },
  getUser: (id) => repository.getUser(id),
  async createAccount(user, passwordHash) {
    const db = await database();
    const session = db.client.startSession();
    try {
      // Both unique email indexes and profile creation commit together.
      await session.withTransaction(async () => {
        await db
          .collection<StoredUser>("folio_users")
          .insertOne({ _id: user.id, ...user }, { session });
        await db
          .collection<Credential>("folio_credentials")
          .insertOne(
            {
              _id: user.id,
              email: user.email,
              passwordHash,
              createdAt: new Date(),
            },
            { session },
          );
      });
    } finally {
      await session.endSession();
    }
  },
  async createSession(value) {
    await (
      await database()
    )
      .collection<AuthSession>("folio_sessions")
      .insertOne(value);
  },
  async getSession(digest, now) {
    return (await database())
      .collection<AuthSession>("folio_sessions")
      .findOne({ _id: digest, expiresAt: { $gt: now } });
  },
  async deleteSession(digest) {
    await (
      await database()
    )
      .collection<AuthSession>("folio_sessions")
      .deleteOne({ _id: digest });
  },
  async incrementRate(key, expiresAt) {
    const collection = (await database()).collection<AuthRate>(
      "folio_auth_rates",
    );
    const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt } };
    try {
      const rate = await collection.findOneAndUpdate({ _id: key }, update, {
        upsert: true,
        returnDocument: "after",
      });
      return rate!.count;
    } catch (error) {
      // Concurrent first requests may race the upsert's unique _id index.
      if ((error as { code?: number }).code !== 11000) throw error;
      return (await collection.findOneAndUpdate(
        { _id: key },
        { $inc: { count: 1 } },
        { returnDocument: "after" },
      ))!.count;
    }
  },
};
export function authService(
  repo: AuthRepository,
  now: () => Date = () => new Date(),
) {
  async function rateLimit(
    action: "sign-in" | "sign-up",
    ip: string,
    email: string,
  ) {
    const window = Math.floor(now().getTime() / RATE_WINDOW);
    const expiresAt = new Date((window + 1) * RATE_WINDOW);
    const ipCount = await repo.incrementRate(
      `${action}:ip:${tokenDigest(ip)}:${window}`,
      expiresAt,
    );
    const emailCount = await repo.incrementRate(
      `${action}:email:${tokenDigest(email)}:${window}`,
      expiresAt,
    );
    if (
      ipCount > (action === "sign-in" ? 60 : 20) ||
      emailCount > (action === "sign-in" ? 12 : 5)
    )
      throw new AppError(
        429,
        "RATE_LIMITED",
        "Too many attempts. Please try again in 15 minutes.",
      );
  }
  async function issueSession(user: User) {
    const token = randomBytes(32).toString("base64url");
    const createdAt = now();
    const expiresAt = new Date(createdAt.getTime() + SESSION_SECONDS * 1000);
    await repo.createSession({
      _id: tokenDigest(token),
      userId: user.id,
      createdAt,
      expiresAt,
    });
    return { user, token, expiresAt };
  }
  return {
    async signIn(value: unknown, ip: string) {
      const { email, password } = signInSchema.parse(value);
      await rateLimit("sign-in", ip, email);
      const credential = await repo.getCredential(email);
      const valid = await verifyPassword(
        password,
        credential?.passwordHash ?? DUMMY_HASH,
      );
      if (!credential || !valid)
        throw new AppError(
          401,
          "INVALID_CREDENTIALS",
          "Email or password is incorrect.",
        );
      const user = await repo.getUser(credential._id);
      if (!user)
        throw new AppError(
          401,
          "INVALID_CREDENTIALS",
          "Email or password is incorrect.",
        );
      return issueSession(user);
    },
    async signUp(value: unknown, ip: string) {
      const { name, email, password } = signUpSchema.parse(value);
      await rateLimit("sign-up", ip, email);
      const passwordHash = await hashPassword(password);
      const words = name.split(/\s+/);
      const user: User = {
        id: randomUUID(),
        name,
        email,
        initials: (
          words[0][0] +
          (words.length > 1 ? words[words.length - 1][0] : (words[0][1] ?? ""))
        ).toUpperCase(),
        color: "#d9e5dd",
      };
      try {
        await repo.createAccount(user, passwordHash);
      } catch (error) {
        if ((error as { code?: number }).code === 11000)
          throw new AppError(
            409,
            "EMAIL_IN_USE",
            "An account with this email already exists.",
          );
        throw error;
      }
      return issueSession(user);
    },
    async userForToken(token: string | undefined): Promise<User | null> {
      if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
      const current = now();
      const session = await repo.getSession(tokenDigest(token), current);
      if (!session || session.expiresAt.getTime() <= current.getTime())
        return null;
      return repo.getUser(session.userId);
    },
    async signOut(token: string | undefined) {
      if (token && /^[A-Za-z0-9_-]{43}$/.test(token))
        await repo.deleteSession(tokenDigest(token));
    },
  };
}
export const auth = authService(authRepository);
