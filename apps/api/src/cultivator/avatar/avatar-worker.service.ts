import {
  AVATAR_SIZES,
  type AvatarFailure,
} from '@daoyou/contracts/player/avatar';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import { grantInventory } from '@server/inventory/operations.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { cultivatorAvatars, cultivators } from '@server/lib/drizzle/schema.js';
import { SystemCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import {
  AvatarRenderError,
  AvatarRendererService,
} from './avatar-renderer.service.js';
import { AvatarStorageService } from './avatar-storage.service.js';

type AvatarJob = typeof cultivatorAvatars.$inferSelect;
const LEASE_MS = 180_000;
const RETRY_DELAY_MS = 10_000;
const MAX_PROCESSING_ATTEMPTS = 3;

@Injectable()
export class AvatarWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(AvatarWorkerService.name);
  private working: Promise<void> | undefined;
  private stopping = false;

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
    @Inject(SystemCommandExecutor)
    private readonly commands: SystemCommandExecutor,
    @Inject(AvatarRendererService)
    private readonly renderer: AvatarRendererService,
    @Inject(AvatarStorageService)
    private readonly storage: AvatarStorageService,
  ) {}

  @Interval(3_000)
  async tick() {
    if (this.stopping || this.working) return;
    this.working = this.work().catch(() => {
      // Provider errors may contain source URLs, authorization headers or text.
      this.logger.warn('Avatar job scan failed');
    });
    try {
      await this.working;
    } finally {
      this.working = undefined;
    }
  }

  async onModuleDestroy() {
    this.stopping = true;
    await this.working;
  }

  private async claim() {
    return this.database.transaction(async (tx) => {
      const now = new Date();
      const [job] = await tx
        .select()
        .from(cultivatorAvatars)
        .where(
          and(
            inArray(cultivatorAvatars.status, [
              'queued',
              'generating',
              'processing',
            ]),
            or(
              isNull(cultivatorAvatars.leaseUntil),
              lte(cultivatorAvatars.leaseUntil, now),
            ),
          ),
        )
        .orderBy(asc(cultivatorAvatars.createdAt))
        .limit(1)
        .for('update', { skipLocked: true });
      if (!job) return;
      const leaseUntil = new Date(now.getTime() + LEASE_MS);
      await tx
        .update(cultivatorAvatars)
        .set({
          leaseUntil,
          status: job.status === 'queued' ? 'generating' : job.status,
        })
        .where(eq(cultivatorAvatars.id, job.id));
      return { ...job, leaseUntil };
    });
  }

  private async work() {
    const job = await this.claim();
    if (job) await this.run(job);
    // A retired/deleted character can receive its refund once the account plays again.
    const [unrefunded] = await this.database
      .select({ id: cultivatorAvatars.id, userId: cultivatorAvatars.userId })
      .from(cultivatorAvatars)
      .where(
        and(
          eq(cultivatorAvatars.status, 'failed'),
          isNotNull(cultivatorAvatars.reservedItem),
          sql`exists (select 1 from ${cultivators}
          where ${cultivators.userId} = ${cultivatorAvatars.userId}
            and ${cultivators.status} = 'active')`,
        ),
      )
      .limit(1);
    if (unrefunded) await this.refund(unrefunded.id, unrefunded.userId);
    if (!this.storage.configured) return;
    const [orphan] = await this.database
      .select({ id: cultivatorAvatars.id })
      .from(cultivatorAvatars)
      .where(
        and(
          eq(cultivatorAvatars.status, 'failed'),
          eq(cultivatorAvatars.cleanupPending, true),
        ),
      )
      .limit(1);
    if (orphan) {
      await Promise.all(
        AVATAR_SIZES.map((size) => this.storage.remove(orphan.id, size)),
      );
      await this.database
        .update(cultivatorAvatars)
        .set({ cleanupPending: false })
        .where(eq(cultivatorAvatars.id, orphan.id));
    }
  }

  private async run(job: AvatarJob & { leaseUntil: Date }) {
    const claimed = and(
      eq(cultivatorAvatars.id, job.id),
      eq(cultivatorAvatars.leaseUntil, job.leaseUntil),
    );
    let sourceUrl = job.sourceUrl;
    if (job.deadlineAt.getTime() <= Date.now() || job.status === 'generating') {
      // A previous process could have submitted the request before it stopped.
      await this.fail(
        job,
        job.status === 'processing' ? 'storage' : 'generation',
      );
      return;
    }
    if (job.status === 'queued') {
      try {
        if (!this.renderer.configured)
          throw new AvatarRenderError('generation');
        sourceUrl = await this.renderer.generate(job.description, job.userId);
      } catch (error) {
        await this.fail(
          job,
          error instanceof AvatarRenderError ? error.reason : 'generation',
        );
        return;
      }
      const [continued] = await this.database
        .update(cultivatorAvatars)
        .set({ status: 'processing', sourceUrl })
        .where(claimed)
        .returning({ id: cultivatorAvatars.id });
      if (!continued) return;
    }
    const processingAttempts = job.processingAttempts + 1;
    try {
      if (!sourceUrl) throw new AvatarRenderError('generation');
      if (!this.storage.configured) throw new AvatarRenderError('storage');
      await this.renderer.process(
        job.id,
        sourceUrl,
        job.status === 'processing',
      );
    } catch (error) {
      if (
        error instanceof AvatarRenderError ||
        processingAttempts >= MAX_PROCESSING_ATTEMPTS
      ) {
        await this.fail(
          job,
          error instanceof AvatarRenderError ? error.reason : 'storage',
        );
      } else {
        await this.database
          .update(cultivatorAvatars)
          .set({
            processingAttempts,
            leaseUntil: new Date(Date.now() + RETRY_DELAY_MS),
          })
          .where(claimed);
      }
      return;
    }
    // The single transition both settles the reserved talisman and grants ownership.
    await this.database
      .update(cultivatorAvatars)
      .set({
        status: 'ready',
        reservedItem: null,
        sourceUrl: null,
        leaseUntil: null,
      })
      .where(claimed);
  }

  private async fail(
    job: AvatarJob & { leaseUntil: Date },
    failure: AvatarFailure,
  ) {
    const [changed] = await this.database
      .update(cultivatorAvatars)
      .set({
        status: 'failed',
        failure,
        cleanupPending: sql`${cultivatorAvatars.sourceUrl} is not null`,
        sourceUrl: null,
        leaseUntil: null,
      })
      .where(
        and(
          eq(cultivatorAvatars.id, job.id),
          eq(cultivatorAvatars.leaseUntil, job.leaseUntil),
        ),
      )
      .returning({ id: cultivatorAvatars.id });
    if (changed) await this.refund(job.id, job.userId);
  }

  private async refund(id: string, userId: string) {
    await this.commands.execute({
      source: 'avatar_refund',
      actor: { userId },
      allowEmpty: true,
      command: async (tx) => {
        const [target] = await tx
          .select({ id: cultivators.id })
          .from(cultivators)
          .where(
            and(
              eq(cultivators.userId, userId),
              eq(cultivators.status, 'active'),
            ),
          )
          .limit(1)
          .for('update');
        if (!target) return { result: null, resourceChanges: [] };
        const [job] = await tx
          .select({ reservedItem: cultivatorAvatars.reservedItem })
          .from(cultivatorAvatars)
          .where(
            and(
              eq(cultivatorAvatars.id, id),
              eq(cultivatorAvatars.userId, userId),
              eq(cultivatorAvatars.status, 'failed'),
            ),
          )
          .for('update');
        if (!job?.reservedItem) return { result: null, resourceChanges: [] };
        const delivered = await grantInventory(
          target.id,
          [job.reservedItem],
          tx,
        );
        const location = delivered[0]?.location;
        if (!location) throw new Error('Avatar talisman was not returned');
        await tx
          .update(cultivatorAvatars)
          .set({ reservedItem: null, refundLocation: location })
          .where(eq(cultivatorAvatars.id, id));
        return {
          result: location,
          resourceChanges: [
            {
              scope: { kind: 'cultivator', id: target.id },
              resourceTopic: 'inventory.bag',
              eventType: 'inventory.avatar.refunded',
              operation: 'invalidate',
            },
          ],
        };
      },
    });
  }
}
