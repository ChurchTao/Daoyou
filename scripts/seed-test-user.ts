/**
 * One-shot dev seed script: creates a login-ready test account directly in the
 * `better_auth` schema, bypassing email verification (which requires SMTP).
 *
 * Usage:
 *   bun --env-file=.env.local run scripts/seed-test-user.ts
 *
 * Re-runnable: if the test email already exists, it updates emailVerified and
 * the password so the account stays usable.
 */
import { randomBytes, scrypt } from 'node:crypto';
import { Pool } from 'pg';

const TEST_EMAIL = 'test@daoyou.local';
const TEST_PASSWORD = 'Test123456';
const TEST_NAME = '测试道友';

const scryptConfig = { N: 16384, r: 16, p: 1, dkLen: 64 };

function generateKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      scryptConfig.dkLen,
      {
        N: scryptConfig.N,
        r: scryptConfig.r,
        p: scryptConfig.p,
        maxmem: 128 * scryptConfig.N * scryptConfig.r * 2,
      },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      },
    );
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await generateKey(password, salt);
  return `${salt}:${key.toString('hex')}`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required. Run with: bun --env-file=.env.local run scripts/seed-test-user.ts');
  }

  const pool = new Pool({ connectionString, ssl: false });
  const passwordHash = await hashPassword(TEST_PASSWORD);

  try {
    const existing = await pool.query(
      `SELECT id FROM "better_auth"."user" WHERE email = $1`,
      [TEST_EMAIL],
    );

    let userId: string;

    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      await pool.query(
        `UPDATE "better_auth"."user"
           SET "emailVerified" = true, name = $2, "updatedAt" = now()
         WHERE id = $1`,
        [userId, TEST_NAME],
      );
      await pool.query(
        `UPDATE "better_auth"."account"
            SET password = $2, "updatedAt" = now()
          WHERE "userId" = $1 AND "providerId" = 'credential'`,
        [userId, passwordHash],
      );
      const accountExists = await pool.query(
        `SELECT id FROM "better_auth"."account"
          WHERE "userId" = $1 AND "providerId" = 'credential'`,
        [userId],
      );
      if (accountExists.rows.length === 0) {
        await pool.query(
          `INSERT INTO "better_auth"."account" ("accountId", "providerId", "userId", password, "createdAt", "updatedAt")
           VALUES ($1, 'credential', $2, $3, now(), now())`,
          [userId, userId, passwordHash],
        );
      }
      console.log(`[seed] updated existing test user: ${userId}`);
    } else {
      const inserted = await pool.query(
        `INSERT INTO "better_auth"."user" (name, email, "emailVerified")
         VALUES ($1, $2, true)
         RETURNING id`,
        [TEST_NAME, TEST_EMAIL],
      );
      userId = inserted.rows[0].id;
      await pool.query(
        `INSERT INTO "better_auth"."account" ("accountId", "providerId", "userId", password, "createdAt", "updatedAt")
         VALUES ($1, 'credential', $2, $3, now(), now())`,
        [userId, userId, passwordHash],
      );
      console.log(`[seed] created new test user: ${userId}`);
    }

    console.log('');
    console.log('========================================');
    console.log('  测试账号已就绪，可直接登录');
    console.log('========================================');
    console.log(`  邮箱: ${TEST_EMAIL}`);
    console.log(`  密码: ${TEST_PASSWORD}`);
    console.log(`  用户ID: ${userId}`);
    console.log('========================================');
    console.log('');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
