import { withAdminAuth } from '@/lib/api/adminAuth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { z } from 'zod';

const EmailBroadcastSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(10000),
  dryRun: z.boolean().optional().default(false),
});

async function listConfirmedEmails(): Promise<string[]> {
  const admin = createAdminClient();
  const emails: string[] = [];
  const perPage = 200;

  for (let page = 1; page <= 1000; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`Supabase listUsers failed: ${error.message}`);
    }

    const users = data?.users ?? [];
    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      if (user.email && user.email_confirmed_at) {
        emails.push(user.email.toLowerCase());
      }
    }

    if (users.length < perPage) {
      break;
    }
  }

  return [...new Set(emails)];
}

function createSmtpTransporter() {
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

async function sendViaSmtp(email: string, subject: string, content: string) {
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

export const POST = withAdminAuth(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = EmailBroadcastSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数错误', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { subject, content, dryRun } = parsed.data;

  const recipients = await listConfirmedEmails();
  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalRecipients: recipients.length,
    });
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  const batchSize = 10;

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((email) => sendViaSmtp(email, subject, content)),
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        sent += 1;
      } else {
        failed += 1;
        if (errors.length < 10) {
          errors.push(
            `${batch[index]}: ${result.reason?.message ?? 'unknown'}`,
          );
        }
      }
    });
  }

  return NextResponse.json({
    success: failed === 0,
    totalRecipients: recipients.length,
    sent,
    failed,
    errors,
  });
});
