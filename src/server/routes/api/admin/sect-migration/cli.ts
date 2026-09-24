/** Temporary offline entrypoint; uses the same migration service as the admin UI. */
import { isAdminIdentity } from '@server/lib/auth/adminAccess';
import { authUsers } from '@server/lib/auth/schema';
import { db } from '@server/lib/drizzle/db';
import type { SectMigrationReport } from '@shared/contracts/sectMigration';
import { eq } from 'drizzle-orm';
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { z } from 'zod';
import {
  exportSectMigrationAudit,
  sectMigrationReport,
  streamSectMigration,
} from './service';

function summarize(report: SectMigrationReport) {
  return {
    phase: report.phase,
    complete: report.complete,
    issues: report.issues,
    ready: report.rows.filter((row) => row.status === 'ready').length,
    completed: report.rows.filter((row) => row.status === 'completed').length,
    blocked: report.rows.filter((row) => row.status === 'blocked').length,
    totals: report.totals,
  };
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'dry-run': { type: 'boolean' },
      apply: { type: 'boolean' },
      maintenance: { type: 'boolean' },
      'operator-id': { type: 'string' },
      audit: { type: 'string' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.apply && values['dry-run'])
    throw new Error('--apply 与 --dry-run 不能同时使用');
  if (values.apply && (!values.maintenance || !values.audit))
    throw new Error(
      '执行需要 --maintenance、--operator-id 和 --audit 文件路径',
    );
  let operatorId: string | undefined;
  if (values.apply) {
    operatorId = z.uuid().parse(values['operator-id']);
    const [operator] = await db
      .select()
      .from(authUsers)
      .where(eq(authUsers.id, operatorId));
    if (!operator || !isAdminIdentity(operator))
      throw new Error('执行人必须是环境配置中已有的管理员');
  }

  const preflight = await sectMigrationReport();
  console.log(
    JSON.stringify({
      mode: values.apply ? 'apply' : 'dry-run',
      ...summarize(preflight),
    }),
  );
  // Reserve the audit path before writes; never overwrite an earlier receipt file.
  if (values.audit)
    writeFileSync(values.audit, JSON.stringify({ preflight }, null, 2), {
      flag: 'wx',
      mode: 0o600,
    });
  if (!values.apply) return preflight.issues.length ? 2 : 0;
  if (!preflight.enabled || preflight.issues.length)
    throw new Error('迁移结构或来源清单异常，请检查预检报告');

  const ids = preflight.rows
    .filter((row) => row.status === 'ready')
    .map((row) => row.membershipId);
  let processed = 0;
  let failed = 0;
  for await (const result of streamSectMigration(ids, operatorId!, true)) {
    processed++;
    if (result.status === 'failed') {
      failed++;
      console.error(JSON.stringify(result));
    }
    if (processed % 20 === 0 || processed === ids.length)
      console.log(JSON.stringify({ processed, total: ids.length, failed }));
  }

  const audit = await exportSectMigrationAudit();
  writeFileSync(values.audit!, JSON.stringify(audit, null, 2), { mode: 0o600 });
  console.log(
    JSON.stringify({ audit: values.audit, ...summarize(audit.report) }),
  );
  return failed || !audit.report.complete ? 2 : 0;
}

try {
  process.exit(await main());
} catch (error) {
  console.error(error instanceof Error ? error.message : '宗门迁移失败');
  process.exit(1);
}
