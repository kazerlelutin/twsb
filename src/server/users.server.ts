import { db, now, uid } from "./db.server";
import { hashPassword, randomToken, sha256 } from "./password.server";

export type Role = "admin" | "editor";
export type UserStatus = "pending" | "active" | "disabled";
export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  createdAt: number;
};

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  password_hash: string | null;
  token_hash: string | null;
  token_expires_at: number | null;
  created_at: number;
};

const toUser = (r: UserRow): User => ({
  id: r.id,
  email: r.email,
  name: r.name,
  role: r.role,
  status: r.status,
  createdAt: r.created_at,
});

const SESSION_DAYS = 30;
const INVITE_HOURS = 72;

export const countUsers = () =>
  db().get<{ n: number }>("SELECT COUNT(*) AS n FROM users")?.n ?? 0;
export const listUsers = () =>
  db().all<UserRow>("SELECT * FROM users ORDER BY created_at").map(toUser);
export const getUser = (id: string) => {
  const row = db().get<UserRow>("SELECT * FROM users WHERE id = ?", id);
  return row ? toUser(row) : undefined;
};
export const userRowByEmail = (email: string) =>
  db().get<UserRow>("SELECT * FROM users WHERE email = ?", email.trim());

export async function createActiveUser(
  email: string,
  password: string,
  role: Role,
  name = "",
) {
  const t = now();
  const id = uid();
  db().run(
    "INSERT INTO users (id, email, name, role, status, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, ?)",
    id,
    email.trim(),
    name,
    role,
    await hashPassword(password),
    t,
    t,
  );
  return getUser(id) as User;
}

/** Crée un compte en attente et renvoie le jeton d'activation en clair. */
export function inviteUser(email: string, role: Role, name = "") {
  const t = now();
  const id = uid();
  const token = randomToken();
  db().run(
    "INSERT INTO users (id, email, name, role, status, token_hash, token_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)",
    id,
    email.trim(),
    name,
    role,
    sha256(token),
    t + INVITE_HOURS * 3600_000,
    t,
    t,
  );
  return { user: getUser(id) as User, token };
}

export function renewToken(id: string) {
  const token = randomToken();
  db().run(
    "UPDATE users SET token_hash = ?, token_expires_at = ?, updated_at = ? WHERE id = ?",
    sha256(token),
    now() + INVITE_HOURS * 3600_000,
    now(),
    id,
  );
  return token;
}

export function userByToken(token: string) {
  const row = db().get<UserRow>(
    "SELECT * FROM users WHERE token_hash = ? AND token_expires_at > ?",
    sha256(token),
    now(),
  );
  return row ? toUser(row) : undefined;
}

export async function activateUser(
  token: string,
  password: string,
  name?: string,
) {
  const user = userByToken(token);
  if (!user || user.status === "disabled") return undefined;
  db().run(
    "UPDATE users SET status = 'active', password_hash = ?, name = COALESCE(NULLIF(?, ''), name), token_hash = NULL, token_expires_at = NULL, updated_at = ? WHERE id = ?",
    await hashPassword(password),
    name ?? "",
    now(),
    user.id,
  );
  return getUser(user.id);
}

export function updateUser(
  id: string,
  patch: { name?: string; role?: Role; status?: UserStatus },
) {
  const current = getUser(id);
  if (!current) return undefined;
  db().run(
    "UPDATE users SET name = ?, role = ?, status = ?, updated_at = ? WHERE id = ?",
    patch.name ?? current.name,
    patch.role ?? current.role,
    patch.status ?? current.status,
    now(),
    id,
  );
  if (patch.status === "disabled")
    db().run("DELETE FROM sessions WHERE user_id = ?", id);
  return getUser(id);
}

export async function setPassword(id: string, password: string) {
  db().run(
    "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
    await hashPassword(password),
    now(),
    id,
  );
}

export const deleteUser = (id: string) =>
  db().run("DELETE FROM users WHERE id = ?", id).changes > 0;

export const activeAdmins = () =>
  db().get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND status = 'active'",
  )?.n ?? 0;

/* Sessions : jeton aléatoire côté client, empreinte en base. */
export function createSession(userId: string) {
  const token = randomToken();
  db().run(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
    sha256(token),
    userId,
    now() + SESSION_DAYS * 86400_000,
  );
  db().run("DELETE FROM sessions WHERE expires_at < ?", now());
  return { token, maxAge: SESSION_DAYS * 86400 };
}

export function userBySession(token: string | undefined) {
  if (!token) return undefined;
  const row = db().get<UserRow>(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ? AND u.status = 'active'",
    sha256(token),
    now(),
  );
  return row ? toUser(row) : undefined;
}

export const destroySession = (token: string) =>
  db().run("DELETE FROM sessions WHERE id = ?", sha256(token));
