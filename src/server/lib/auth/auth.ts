import { sendViaSmtp } from '../admin/smtp';
import { pgPool } from '../drizzle/db';
import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins/email-otp';

function getRequiredEnv(name: 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL') {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing Better Auth config: ${name}`);
  }

  return value;
}

function getBetterAuthSchemaName() {
  return process.env.BETTER_AUTH_DB_SCHEMA?.trim() || 'better_auth';
}

function getGitHubProviderConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return undefined;
  }

  return {
    clientId,
    clientSecret,
  };
}

function fallbackDisplayName(email: string, name?: string | null) {
  const trimmedName = name?.trim();

  if (trimmedName) {
    return trimmedName;
  }

  const [prefix] = email.split('@');
  return prefix?.trim() || '道友';
}

export const authSchemaName = getBetterAuthSchemaName();

export const auth = betterAuth({
  baseURL: getRequiredEnv('BETTER_AUTH_URL'),
  secret: getRequiredEnv('BETTER_AUTH_SECRET'),
  database: pgPool,
  advanced: {
    database: {
      generateId: 'uuid',
    },
  },
  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendViaSmtp(
        user.email,
        '【万界道友】重设口令',
        [
          `${user.name || '道友'}，你正在申请重设口令。`,
          '',
          '请点击下方链接继续：',
          url,
          '',
          '若这不是你的操作，可忽略本邮件。',
        ].join('\n'),
      );
    },
  },
  socialProviders: {
    ...(getGitHubProviderConfig()
      ? { github: getGitHubProviderConfig() }
      : {}),
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['github'],
      updateUserInfoOnLink: true,
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 10,
      sendVerificationOTP: async ({ email, otp, type }) => {
        const subject =
          type === 'forget-password'
            ? '【万界道友】重设口令验证码'
            : '【万界道友】登录验证码';

        const headline =
          type === 'forget-password'
            ? '你正在重设口令。'
            : '你正在请求登录口令。';

        await sendViaSmtp(
          email,
          subject,
          [
            headline,
            '',
            `验证码：${otp}`,
            '有效期：10 分钟。',
            '',
            '若这不是你的操作，可忽略本邮件。',
          ].join('\n'),
        );
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          return {
            data: {
              ...user,
              name: fallbackDisplayName(user.email, user.name),
            },
          };
        },
      },
    },
  },
});
