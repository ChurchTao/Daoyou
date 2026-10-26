import { REALM_STAGE_VALUES, REALM_VALUES } from '@daoyou/constants/realms';
import { TRANSFER_FORMAT_VERSION, TransferPackageHeaderSchema, type TransferChallenge } from '@daoyou/contracts/transfer';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient, DbTransaction } from '@server/lib/drizzle/db.js';
import * as schema from '@server/lib/drizzle/schema.js';
import { authUsers } from '@server/lib/auth/schema.js';
import { invalidateActiveCultivatorRef } from '@server/lib/auth/activeCultivator.js';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter.js';
import { withRedisLock, redisLockKeys } from '@server/lib/redis/lock.js';
import { InventoryError } from '@server/inventory/operations.js';
import { and, desc, eq } from 'drizzle-orm';
import { createPublicKey, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { importTransferSnapshot } from './transfer-import.js';
import { readTransferSnapshot, TransferEligibilityError } from './transfer-read.js';
import { arrivalTransferSnapshot, transferPreview, validateTransferSnapshot } from './transfer-snapshot.js';
import { TransferCrypto } from './transfer-crypto.js';

function listed<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

async function recordBoundaryCrossing(
  tx: DbTransaction,
  input: {
    direction: 'departed' | 'arrived' | 'returned';
    userId: string;
    cultivatorId: string;
    cultivatorName: string;
    realm: string;
    realmStage: string;
    deduplicationKey: string;
  },
) {
  if (!listed(REALM_VALUES, input.realm) || !listed(REALM_STAGE_VALUES, input.realmStage)) return;
  await createDomainEvent({
    type: 'cultivator.boundary.crossed',
    aggregate: { type: 'cultivator', id: input.cultivatorId },
    deduplicationKey: input.deduplicationKey,
    data: {
      userId: input.userId,
      cultivatorId: input.cultivatorId,
      cultivatorName: input.cultivatorName,
      realm: input.realm,
      realmStage: input.realmStage,
      direction: input.direction,
    },
  }, tx);
}

function fail(message: string, status = 409): never {
  throw new HttpException({ error: message }, status);
}

@Injectable()
export class TransferService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
    @Inject(TransferCrypto) private readonly crypto: TransferCrypto,
  ) {}

  localIdentity() {
    const identity = this.crypto.signingIdentity();
    return identity ? { enabled: true as const, ...identity } : { enabled: false as const };
  }

  async issue(userId: string) {
    const identity = this.crypto.publicIdentity();
    const existing = await this.database.query.cultivators.findFirst({
      columns: { id: true },
      where: and(eq(schema.cultivators.userId, userId), eq(schema.cultivators.status, 'active')),
    });
    if (existing) fail('目标账号已有有效角色，不能导入');
    const requestId = randomUUID();
    const challenge: TransferChallenge = {
      version: TRANSFER_FORMAT_VERSION, requestId, targetServerId: identity.serverId, targetUserId: userId,
      encryptionPublicKey: identity.encryptionPublicKey,
      signingPublicKey: identity.signingPublicKey,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
    const compact = await this.crypto.signChallenge(challenge);
    await this.database.insert(schema.transferImportRequests).values({
      id: requestId, userId, challenge: compact, expiresAt: new Date(challenge.expiresAt),
    });
    return { requestId, challenge: compact, expiresAt: challenge.expiresAt };
  }

  async export(userId: string, cultivatorId: string, challengeString: string) {
    let challenge: TransferChallenge;
    try { challenge = await this.crypto.verifyChallenge(challengeString); }
    catch { return fail('目标服凭证无效或已过期', 400); }
    if (challenge.targetServerId === this.crypto.serverId) fail('不能转入当前服务器', 400);
    const result = await withRedisLock({
      key: redisLockKeys.cultivatorMutation(cultivatorId),
      context: 'transfer-export', timeoutMs: 30_000, retries: 0,
    }, () => this.database.transaction(async (tx) => {
      const exportId = randomUUID();
      const snapshot = await readTransferSnapshot(tx, userId, cultivatorId, {
        version: TRANSFER_FORMAT_VERSION, exportId, sourceServerId: this.crypto.serverId!,
        sourceCultivatorId: cultivatorId, targetServerId: challenge.targetServerId,
        targetRequestId: challenge.requestId, targetUserId: challenge.targetUserId,
        exportedAt: new Date().toISOString(),
      });
      const compact = await this.crypto.seal(snapshot, challenge);
      await tx.insert(schema.transferExports).values({
        id: exportId, cultivatorId, targetServerId: challenge.targetServerId,
        targetRequestId: challenge.requestId, challenge: challengeString, package: compact,
      });
      const changed = await tx.update(schema.cultivators)
        .set({ status: 'transfer_pending', updatedAt: new Date() })
        .where(and(eq(schema.cultivators.id, cultivatorId), eq(schema.cultivators.status, 'active')))
        .returning({ id: schema.cultivators.id });
      if (!changed.length) fail('角色状态已变化');
      await recordBoundaryCrossing(tx, {
        direction: 'departed',
        userId,
        cultivatorId,
        cultivatorName: snapshot.role.name,
        realm: snapshot.role.realm,
        realmStage: snapshot.role.realmStage,
        deduplicationKey: `transfer-departed:${exportId}`,
      });
      return { exportId, package: compact, preview: transferPreview(snapshot) };
    })).catch((error: unknown) => {
      if (error instanceof TransferEligibilityError || error instanceof InventoryError) return fail(error.message);
      throw error;
    });
    await invalidateActiveCultivatorRef(userId);
    return result;
  }

  async exportPreview(userId: string, cultivatorId: string) {
    const identity = this.crypto.publicIdentity();
    try {
      const snapshot = await this.database.transaction((tx) => readTransferSnapshot(tx, userId, cultivatorId, {
        version: TRANSFER_FORMAT_VERSION, exportId: randomUUID(), sourceServerId: identity.serverId,
        sourceCultivatorId: cultivatorId, targetServerId: identity.serverId,
        targetRequestId: randomUUID(), targetUserId: userId,
        exportedAt: new Date().toISOString(),
      }));
      return transferPreview(snapshot);
    } catch (error) {
      if (error instanceof TransferEligibilityError || error instanceof InventoryError) return fail(error.message);
      throw error;
    }
  }

  async ownExport(userId: string) {
    const rows = await this.database.select({ export: schema.transferExports, cultivator: schema.cultivators })
      .from(schema.transferExports)
      .innerJoin(schema.cultivators, eq(schema.transferExports.cultivatorId, schema.cultivators.id))
      .where(eq(schema.cultivators.userId, userId))
      .orderBy(desc(schema.transferExports.createdAt));
    return rows.map(({ export: row, cultivator }) => ({
      id: row.id, status: row.status, targetServerId: row.targetServerId,
      targetRequestId: row.targetRequestId, package: row.package,
      characterName: cultivator.name, createdAt: row.createdAt,
    }));
  }

  async resolveExport(userId: string, exportId: string, receipt: string) {
    return this.database.transaction(async (tx) => {
      const [row] = await tx.select({ export: schema.transferExports, cultivator: schema.cultivators })
        .from(schema.transferExports)
        .innerJoin(schema.cultivators, eq(schema.transferExports.cultivatorId, schema.cultivators.id))
        .where(and(eq(schema.transferExports.id, exportId), eq(schema.cultivators.userId, userId)))
        .for('update');
      if (!row || row.export.status !== 'pending') fail('转出申请不可处理');
      const challenge = await this.crypto.verifyChallenge(row.export.challenge, false);
      let result: Awaited<ReturnType<TransferCrypto['verifyReceipt']>>;
      try { result = await this.crypto.verifyReceipt(receipt, challenge); }
      catch { return fail('目标服回执无效', 400); }
      if (result.packageHash !== this.crypto.hash(row.export.package)) fail('回执与原存档不匹配', 400);
      await tx.update(schema.transferExports).set({ status: result.status }).where(eq(schema.transferExports.id, exportId));
      await tx.update(schema.cultivators).set({ status: result.status === 'imported' ? 'transferred' : 'active' })
        .where(eq(schema.cultivators.id, row.export.cultivatorId));
      if (result.status === 'rejected') {
        await recordBoundaryCrossing(tx, {
          direction: 'returned',
          userId,
          cultivatorId: row.cultivator.id,
          cultivatorName: row.cultivator.name,
          realm: row.cultivator.realm,
          realmStage: row.cultivator.realm_stage,
          deduplicationKey: `transfer-returned:${exportId}`,
        });
        await invalidateActiveCultivatorRef(userId);
      }
      return { status: result.status };
    });
  }

  async submit(userId: string, requestId: string, compact: string) {
    if (compact.length > 500_000) fail('存档文件过大', 413);
    let sourceId: string;
    try { sourceId = this.crypto.sourceId(compact); }
    catch { return fail('存档格式无效', 400); }
    const trusted = await this.database.query.transferTrustedServers.findFirst({
      where: and(eq(schema.transferTrustedServers.serverId, sourceId), eq(schema.transferTrustedServers.enabled, true)),
    });
    if (!trusted) fail('来源服务器未获转入许可', 403);
    let snapshot;
    try { snapshot = validateTransferSnapshot(await this.crypto.open(compact, trusted.signingPublicKey)); }
    catch { return fail('存档验签、解密或内容校验失败', 400); }
    return this.database.transaction(async (tx) => {
      const [request] = await tx.select().from(schema.transferImportRequests)
        .where(and(eq(schema.transferImportRequests.id, requestId), eq(schema.transferImportRequests.userId, userId))).for('update');
      if (!request || request.status !== 'issued') fail('导入申请不可提交');
      // 凭证只限制源服发起导出的时间；已签发的存档可在过期后提交或撤销。
      const header = TransferPackageHeaderSchema.parse(snapshot.header);
      if (header.targetServerId !== this.crypto.serverId || header.targetRequestId !== requestId || header.targetUserId !== userId || header.sourceServerId !== sourceId)
        fail('存档目标与当前申请不一致', 400);
      const active = await tx.query.cultivators.findFirst({ columns: { id: true }, where: and(eq(schema.cultivators.userId, userId), eq(schema.cultivators.status, 'active')) });
      if (active) fail('目标账号已有有效角色');
      const preview = transferPreview(snapshot);
      await tx.update(schema.transferImportRequests).set({
        status: 'pending', package: compact, packageHash: this.crypto.hash(compact),
        sourceServerId: sourceId, sourceCultivatorId: header.sourceCultivatorId,
        preview, submittedAt: new Date(),
      }).where(eq(schema.transferImportRequests.id, requestId));
      return { requestId, status: 'pending', preview };
    });
  }

  async ownRequests(userId: string) {
    const rows = await this.database.query.transferImportRequests.findMany({
      where: eq(schema.transferImportRequests.userId, userId),
      orderBy: [desc(schema.transferImportRequests.createdAt)],
    });
    return Promise.all(rows.map(async (row) => ({
      id: row.id, status: row.status, challenge: row.challenge, preview: row.preview,
      expiresAt: row.expiresAt, reviewNote: row.reviewNote,
      receipt: row.status === 'imported' || row.status === 'rejected'
        ? await this.crypto.signReceipt({ requestId: row.id, packageHash: row.packageHash!, status: row.status })
        : null,
    })));
  }

  async cancel(userId: string, requestId: string) {
    return this.database.transaction(async (tx) => {
      const [row] = await tx.select().from(schema.transferImportRequests)
        .where(and(eq(schema.transferImportRequests.id, requestId), eq(schema.transferImportRequests.userId, userId))).for('update');
      if (!row || row.status !== 'pending') fail('申请不是待审核状态');
      await tx.update(schema.transferImportRequests).set({ status: 'rejected', package: null, reviewNote: '玩家撤销导入申请', reviewedAt: new Date() })
        .where(eq(schema.transferImportRequests.id, requestId));
      return { status: 'rejected' as const };
    });
  }

  async trustedServers() {
    return this.database.query.transferTrustedServers.findMany({ orderBy: [desc(schema.transferTrustedServers.createdAt)] });
  }

  async trustServer(adminId: string, serverId: string, publicKey: string) {
    if (!/^[A-Za-z0-9._-]{1,160}$/.test(serverId) || publicKey.length > 4096) fail('服务器标识或公钥格式无效', 400);
    try { if (createPublicKey(publicKey).asymmetricKeyType !== 'ed25519') throw new Error(); }
    catch { return fail('仅支持 Ed25519 签名公钥', 400); }
    const [row] = await this.database.insert(schema.transferTrustedServers).values({ serverId, signingPublicKey: publicKey, createdBy: adminId })
      .onConflictDoUpdate({ target: schema.transferTrustedServers.serverId, set: { signingPublicKey: publicKey, enabled: true, createdBy: adminId, createdAt: new Date() } })
      .returning();
    return row;
  }

  async setTrustEnabled(serverId: string, enabled: boolean) {
    const [row] = await this.database.update(schema.transferTrustedServers).set({ enabled }).where(eq(schema.transferTrustedServers.serverId, serverId)).returning();
    if (!row) fail('来源服务器不存在', 404);
    return row;
  }

  async reviewList() {
    const rows = await this.database.query.transferImportRequests.findMany({
      where: eq(schema.transferImportRequests.status, 'pending'),
      orderBy: [desc(schema.transferImportRequests.submittedAt)],
    });
    return rows.map((row) => ({ id: row.id, userId: row.userId, sourceServerId: row.sourceServerId, sourceCultivatorId: row.sourceCultivatorId, preview: row.preview, submittedAt: row.submittedAt, packageHash: row.packageHash }));
  }

  async reject(adminId: string, requestId: string, note: string) {
    return this.database.transaction(async (tx) => {
      const [row] = await tx.select().from(schema.transferImportRequests).where(eq(schema.transferImportRequests.id, requestId)).for('update');
      if (!row || row.status !== 'pending') fail('申请不是待审核状态');
      await tx.update(schema.transferImportRequests).set({ status: 'rejected', package: null, reviewedBy: adminId, reviewedAt: new Date(), reviewNote: note.slice(0, 1000) }).where(eq(schema.transferImportRequests.id, requestId));
      return { status: 'rejected' as const };
    });
  }

  async approve(adminId: string, requestId: string) {
    const candidate = await this.database.query.transferImportRequests.findFirst({
      columns: { userId: true }, where: eq(schema.transferImportRequests.id, requestId),
    });
    if (!candidate) fail('申请不存在', 404);
    return withRedisLock({
      key: redisLockKeys.cultivatorCreation(candidate.userId),
      context: 'transfer-approve', timeoutMs: 30_000, retries: 0,
    }, () => this.database.transaction(async (tx) => {
      const [row] = await tx.select().from(schema.transferImportRequests).where(eq(schema.transferImportRequests.id, requestId)).for('update');
      if (!row || row.status !== 'pending' || !row.package || !row.packageHash || !row.sourceServerId || !row.sourceCultivatorId)
        fail('申请不是可审核状态');
      const trusted = await tx.query.transferTrustedServers.findFirst({ where: and(eq(schema.transferTrustedServers.serverId, row.sourceServerId), eq(schema.transferTrustedServers.enabled, true)) });
      if (!trusted) fail('来源服务器当前不在白名单');
      if (this.crypto.hash(row.package) !== row.packageHash) fail('存档校验值已变化');
      const snapshot = validateTransferSnapshot(await this.crypto.open(row.package, trusted.signingPublicKey));
      if (this.crypto.sourceId(row.package) !== row.sourceServerId) fail('存档来源与审核申请不一致');
      if (!isDeepStrictEqual(transferPreview(snapshot), row.preview)) fail('存档摘要与审核内容不一致');
      if (snapshot.header.targetRequestId !== row.id || snapshot.header.targetUserId !== row.userId || snapshot.header.targetServerId !== this.crypto.serverId || snapshot.header.sourceServerId !== row.sourceServerId || snapshot.header.sourceCultivatorId !== row.sourceCultivatorId)
        fail('存档身份与审核申请不一致');
      const imported = await tx.query.transferImportRequests.findFirst({
        columns: { id: true },
        where: and(eq(schema.transferImportRequests.sourceServerId, row.sourceServerId), eq(schema.transferImportRequests.sourceCultivatorId, row.sourceCultivatorId), eq(schema.transferImportRequests.status, 'imported')),
      });
      if (imported) fail('该来源角色已经转入');
      await tx.select({ id: authUsers.id }).from(authUsers).where(eq(authUsers.id, row.userId)).for('update');
      const active = await tx.query.cultivators.findFirst({ columns: { id: true }, where: and(eq(schema.cultivators.userId, row.userId), eq(schema.cultivators.status, 'active')) });
      if (active) fail('目标账号已有有效角色');
      const cultivatorId = await importTransferSnapshot(tx, row.userId, arrivalTransferSnapshot(snapshot));
      await tx.update(schema.transferImportRequests).set({ status: 'imported', package: null, importedCultivatorId: cultivatorId, reviewedBy: adminId, reviewedAt: new Date() }).where(eq(schema.transferImportRequests.id, row.id));
      await recordBoundaryCrossing(tx, {
        direction: 'arrived',
        userId: row.userId,
        cultivatorId,
        cultivatorName: snapshot.role.name,
        realm: snapshot.role.realm,
        realmStage: snapshot.role.realmStage,
        deduplicationKey: `transfer-arrived:${row.id}`,
      });
      return { status: 'imported' as const, cultivatorId };
    }));
  }
}
