import nodemailer from "nodemailer";

type Mail = { to: string; subject: string; text: string; html?: string };

let transport: nodemailer.Transporter | null = null;
const configured = () => !!process.env.SMTP_HOST;

/**
 * Sends via SMTP when SMTP_HOST is set. Otherwise the message is logged and
 * `sent: false` is returned — we never pretend an email went out.
 */
export async function sendEmail(mail: Mail): Promise<{ sent: boolean }> {
  if (!configured()) {
    console.info(`[email:not-sent] SMTP not configured. to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    return { sent: false };
  }
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: process.env.EMAIL_FROM, ...mail });
  return { sent: true };
}
