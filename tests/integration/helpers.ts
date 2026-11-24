import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, setDb } from "~/server/db.server";
import { resetEnv } from "~/server/env.server";
import type { ApiEvent } from "~/server/http.server";
import { type Mail, setMailer } from "~/server/mail.server";
import { resetInstalled } from "~/server/public.server";
import { resetAdminCheck } from "~/server/seed.server";
import "~/server/seed.server";
import { testEnv } from "../env";

export const ADMIN = testEnv.admin;

export function freshSite() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "twsb-"));
  process.env.DATA_DIR = dir;
  process.env.ADMIN_EMAIL = ADMIN.email;
  process.env.ADMIN_PASSWORD = ADMIN.password;
  process.env.PUBLIC_URL = "http://site.test";
  delete process.env.SMTP_HOST;
  resetEnv();
  resetAdminCheck();
  resetInstalled();
  setDb(openDb(path.join(dir, "site.sqlite")));
  const mails: Mail[] = [];
  setMailer(async (mail) => {
    mails.push(mail);
  });
  return { dir, mails };
}

type Handler = (event: ApiEvent) => Promise<Response> | Response;

export async function call(
  handler: Handler,
  options: {
    method?: string;
    path?: string;
    body?: unknown;
    form?: FormData;
    cookie?: string;
    params?: Record<string, string>;
    origin?: string;
  } = {},
) {
  const headers: Record<string, string> = { host: "site.test" };
  if (options.cookie) headers.cookie = options.cookie;
  if (options.origin) headers.origin = options.origin;
  let body: BodyInit | undefined;
  if (options.form) body = options.form;
  else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers["content-type"] = "application/json";
  }
  const request = new Request(`http://site.test${options.path ?? "/api"}`, {
    method: options.method ?? (body ? "POST" : "GET"),
    headers,
    body,
  });
  const response = await handler({ request, params: options.params ?? {} });
  const text = await response.clone().text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data, headers: response.headers, response };
}

export const sessionFrom = (headers: Headers) =>
  (headers.get("set-cookie") ?? "").split(";")[0];
