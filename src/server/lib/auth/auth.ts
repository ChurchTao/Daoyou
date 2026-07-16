import { i18n, type TranslationDictionary } from '@better-auth/i18n';
import { betterAuth } from 'better-auth';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { sendViaSmtp } from '../admin/smtp';
import { pgPool } from '../drizzle/db';
import { getPublicWebOrigins } from '../http/origins';
import {
  markAccountDeletionCompleted,
  recordPendingAccountDeletion,
} from '../repositories/accountDeletionRepository';
import { getCookieDomainConfig } from './cookieDomain';

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
  return prefix?.trim() || '玩家';
}

const zhAuthTranslations = {
  USER_NOT_FOUND: '未找到该用户',
  FAILED_TO_CREATE_SESSION: '登录失败，请稍后重试',
  INVALID_PASSWORD: '密码错误',
  INVALID_EMAIL: '邮箱格式错误',
  INVALID_EMAIL_OR_PASSWORD: '邮箱或密码错误',
  PROVIDER_NOT_FOUND: '未找到对应的登录方式',
  INVALID_TOKEN: '凭证无效',
  TOKEN_EXPIRED: '凭证已失效，请重新发起',
  FAILED_TO_GET_USER_INFO: '未能获取用户信息，请稍后重试',
  USER_EMAIL_NOT_FOUND: '未获取到邮箱',
  EMAIL_NOT_VERIFIED: '邮箱尚未验证',
  PASSWORD_TOO_SHORT: '密码太短',
  PASSWORD_TOO_LONG: '密码过长',
  USER_ALREADY_EXISTS: '该邮箱已被占用',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: '该邮箱已被占用，请更换邮箱',
  EMAIL_CAN_NOT_BE_UPDATED: '暂不支持修改邮箱',
  CREDENTIAL_ACCOUNT_NOT_FOUND: '未找到对应的密码登录记录',
  SESSION_EXPIRED: '会话已失效，请重新登录后再试',
  SOCIAL_ACCOUNT_ALREADY_LINKED: '此 GitHub 账号已绑定其他用户',
  INVALID_CALLBACK_URL: '回传地址无效，请稍后重试',
  INVALID_REDIRECT_URL: '跳转地址无效，请稍后重试',
  INVALID_ERROR_CALLBACK_URL: '错误回传地址无效，请稍后重试',
  INVALID_NEW_USER_CALLBACK_URL: '新用户回传地址无效，请稍后重试',
  CALLBACK_URL_REQUIRED: '缺少回传地址，请稍后重试',
  FAILED_TO_CREATE_VERIFICATION: '验证码发送失败，请稍后重试',
  MISSING_FIELD: '请将信息填写完整',
  PASSWORD_ALREADY_SET: '该账号已设置密码',
  OTP_EXPIRED: '验证码已失效，请重新获取',
  INVALID_OTP: '验证码错误',
  TOO_MANY_ATTEMPTS: '尝试次数过多，请重新获取验证码',
} satisfies TranslationDictionary;

export const authSchemaName = getBetterAuthSchemaName();

export const auth = betterAuth({
  baseURL: getRequiredEnv('BETTER_AUTH_URL'),
  secret: getRequiredEnv('BETTER_AUTH_SECRET'),
  trustedOrigins: getPublicWebOrigins(),
  database: pgPool,
  ...(getCookieDomainConfig()
    ? { crossSubDomainCookies: getCookieDomainConfig() }
    : {}),
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
        '【万界道友】重置密码',
        [
          `${user.name || '玩家'}，你正在申请重置密码。`,
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
    ...(getGitHubProviderConfig() ? { github: getGitHubProviderConfig() } : {}),
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['github'],
      updateUserInfoOnLink: true,
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        await recordPendingAccountDeletion(user.id);
      },
      afterDelete: async (user) => {
        try {
          await markAccountDeletionCompleted(user.id);
        } catch (error) {
          console.error('[auth] failed to finalize account deletion record', {
            userId: user.id,
            error,
          });
        }
      },
    },
  },
  plugins: [
    i18n({
      defaultLocale: 'zh',
      translations: {
        zh: zhAuthTranslations,
      },
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 10,
      sendVerificationOTP: async ({ email, otp, type }) => {
        const subject =
          type === 'forget-password'
            ? '【万界道友】重置密码验证码'
            : '【万界道友】邮箱验证码';

        const headline =
          type === 'forget-password'
            ? '你正在重置密码。'
            : '你正在获取登录验证码。首次使用该邮箱时，验证后会自动注册账号。';

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
