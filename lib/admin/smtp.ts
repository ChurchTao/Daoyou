import nodemailer from 'nodemailer';

export function createSmtpTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 465);
  const secure =
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM;

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
