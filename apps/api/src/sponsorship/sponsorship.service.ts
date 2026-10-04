import { HttpException, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  claimSponsorshipOrder,
  createSponsorshipCheckoutIntent,
  getCheckoutIntentStatus,
  getCultivatorMerit,
  getSponsorshipClientConfig,
  listPublicMeritProfiles,
  recordAfdianWebhook,
  updateMeritVisibility,
} from '@server/sponsorship/application/SponsorshipApplicationService.js';
import type {
  SponsorshipCheckoutRequest,
  SponsorshipClaimRequest,
} from '@daoyou/contracts/sponsorship';
import { z } from 'zod';
@Injectable()
export class SponsorshipService {
  async webhook(payload: unknown) {
    await recordAfdianWebhook(payload);
    return { ec: 200, em: '' };
  }
  config() {
    return getSponsorshipClientConfig();
  }
  publicProfiles(query: { page: number; pageSize: number }) {
    return listPublicMeritProfiles(query.page, query.pageSize);
  }
  merit(actor: ActiveCultivatorRef) {
    return getCultivatorMerit(actor.cultivatorId);
  }
  async visibility(actor: ActiveCultivatorRef, isPublic: boolean) {
    const updated = await updateMeritVisibility(actor.cultivatorId, isPublic);
    return { success: true, updated };
  }
  checkout(actor: ActiveCultivatorRef, input: SponsorshipCheckoutRequest) {
    return createSponsorshipCheckoutIntent({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      ...input,
    });
  }
  async checkoutStatus(actor: ActiveCultivatorRef, rawId: string) {
    const id = z.uuid().safeParse(rawId);
    if (!id.success) throw new HttpException({ error: '下单意图不存在' }, 404);
    const status = await getCheckoutIntentStatus({
      id: id.data,
      userId: actor.userId,
    });
    if (!status) throw new HttpException({ error: '下单意图不存在' }, 404);
    return status;
  }
  async claim(actor: ActiveCultivatorRef, input: SponsorshipClaimRequest) {
    await claimSponsorshipOrder({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      ...input,
    });
    return { success: true };
  }
}
