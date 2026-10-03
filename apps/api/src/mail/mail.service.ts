import type { SendMailRequest } from '@daoyou/shared/contracts/mail';
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { mails } from '@server/lib/drizzle/schema.js';
import { publicMailAttachment } from '@server/mail/application/MailInventory.js';
import type { MailAttachment } from '@server/mail/application/MailService.js';
import {
  claimAllCultivatorMail,
  claimCultivatorMail,
  markAllCultivatorMailRead,
  markCultivatorMailRead,
  sendCultivatorMail,
} from '@server/mail/application/PlayerMailApplicationService.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import { scheduleSystemMailObservation } from '@server/mail/application/SystemMailService.js';
import { and, desc, eq, sql } from 'drizzle-orm';

@Injectable()
export class MailService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  async list(cultivatorId: string, pageValue?: string, pageSizeValue?: string) {
    scheduleSystemMailObservation(cultivatorId, 'mailbox');
    const pageRaw = parseInt(pageValue || '1', 10);
    const pageSizeRaw = parseInt(pageSizeValue || '20', 10);
    const page = Number.isNaN(pageRaw) ? 1 : Math.max(1, pageRaw);
    const pageSize = Number.isNaN(pageSizeRaw)
      ? 20
      : Math.min(100, Math.max(1, pageSizeRaw));
    const rows = await this.database.query.mails.findMany({
      where: eq(mails.cultivatorId, cultivatorId),
      orderBy: [desc(mails.createdAt)],
      limit: pageSize + 1,
      offset: (page - 1) * pageSize,
    });
    const hasMore = rows.length > pageSize;
    return {
      mails: (hasMore ? rows.slice(0, pageSize) : rows).map((mail) => ({
        ...mail,
        attachments: (Array.isArray(mail.attachments)
          ? (mail.attachments as MailAttachment[])
          : []
        ).map(publicMailAttachment),
      })),
      pagination: { page, pageSize, hasMore },
    };
  }

  async unreadCount(cultivatorId: string) {
    const [result] = await this.database
      .select({ count: sql<number>`count(*)::int` })
      .from(mails)
      .where(
        and(eq(mails.cultivatorId, cultivatorId), eq(mails.isRead, false)),
      );
    return { count: Number(result?.count ?? 0) };
  }

  async send(actor: ActiveCultivatorRef, input: SendMailRequest) {
    return toPlayerStateMutationResponse(
      await sendCultivatorMail({ actor, ...input }),
    );
  }

  async claim(actor: ActiveCultivatorRef, mailId: string) {
    return toPlayerStateMutationResponse(
      await claimCultivatorMail({ actor, mailId }),
    );
  }

  async claimAll(actor: ActiveCultivatorRef, requestId: string) {
    return toPlayerStateMutationResponse(
      await claimAllCultivatorMail({ actor, requestId }),
    );
  }

  async read(actor: ActiveCultivatorRef, mailId: string) {
    return toPlayerStateMutationResponse(
      await markCultivatorMailRead({ actor, mailId }),
    );
  }

  async readAll(actor: ActiveCultivatorRef) {
    return toPlayerStateMutationResponse(
      await markAllCultivatorMailRead({ actor }),
    );
  }
}
