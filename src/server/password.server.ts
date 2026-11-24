import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const scryptAsync = (password: string, salt: Buffer, length: number) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, length, { N: 16384, r: 8, p: 1 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 32);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
) {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scryptAsync(
    password,
    Buffer.from(salt, "base64"),
    expected.length,
  );
  return timingSafeEqual(key, expected);
}

export const randomToken = () => randomBytes(32).toString("base64url");
export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export const PASSWORD_MIN = 10;
export const passwordProblem = (password: string) =>
  password.length < PASSWORD_MIN
    ? `Au moins ${PASSWORD_MIN} caractères.`
    : undefined;
