import { esc } from "../features/render/html";
import { config } from "./config.server";
import { getIdentity } from "./repo.server";

export type Mail = { to: string; subject: string; text: string; html: string };
export type Mailer = (mail: Mail) => Promise<void>;

let override: Mailer | undefined;
/** Tests : capture les envois. */
export const setMailer = (mailer: Mailer | undefined) => {
  override = mailer;
};

export async function sendMail(mail: Mail): Promise<boolean> {
  if (override) {
    await override(mail);
    return true;
  }
  const smtp = config().smtp;
  if (!smtp) {
    console.info(
      `[mail] SMTP non configuré | ${mail.to} | ${mail.subject}\n${mail.text}`,
    );
    return false;
  }
  const { createTransport } = await import("nodemailer");
  const transport = createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  await transport.sendMail({ from: smtp.from, ...mail });
  return true;
}

export const activationUrl = (token: string) =>
  `${config().publicUrl}/admin/activate?token=${encodeURIComponent(token)}`;

export function accountMail(
  to: string,
  token: string,
  kind: "invite" | "reset",
): Mail {
  const site = getIdentity().name;
  const url = activationUrl(token);
  const subject =
    kind === "invite"
      ? `${site} | Activez votre compte`
      : `${site} | Nouveau mot de passe`;
  const action =
    kind === "invite" ? "Activer mon compte" : "Choisir un mot de passe";
  return {
    to,
    subject,
    text: `${action} : ${url}\nLien valable 72 heures.`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#101c2c"><h1 style="font-size:20px">${esc(site)}</h1><p><a href="${esc(url)}" style="display:inline-block;padding:10px 16px;border:1px solid #1c608b;border-radius:5px;color:#1c608b;font-weight:600;text-decoration:none">${action}</a></p><p style="color:#51637a;font-size:13px">Lien valable 72 heures.</p></div>`,
  };
}
