import { getRuntimeEnvironment } from '@server/lib/config/environment.js';
import nodemailer from 'nodemailer';

export function createSmtpTransporter() {
  const host = getRuntimeEnvironment().SMTP_HOST;
  const port = Number(getRuntimeEnvironment().SMTP_PORT ?? 465);
  const secure =
    getRuntimeEnvironment().SMTP_SECURE !== undefined
      ? getRuntimeEnvironment().SMTP_SECURE === 'true'
      : port === 465;
  const user = getRuntimeEnvironment().SMTP_USER;
  const pass = getRuntimeEnvironment().SMTP_PASS;
  const from = getRuntimeEnvironment().MAIL_FROM;

  if (!host || !port || !user || !pass || !from) {
    throw new Error(
      'Missing SMTP config: SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/MAIL_FROM',
    );
  }

  return {
    transporter: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    }),
    from,
  };
}

export async function sendViaSmtp(
  email: string,
  subject: string,
  content: string,
) {
  const { transporter, from } = createSmtpTransporter();
  const html = content
    .split('\n')
    .map((line) => line.trim())
    .join('<br />');

  await transporter.sendMail({
    from,
    to: email,
    subject,
    text: content,
    html,
  });
}
