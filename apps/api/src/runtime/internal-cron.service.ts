import { Inject, Injectable } from '@nestjs/common';
import { AuctionBuyOrderOperations } from '@server/auction/application/AuctionBuyOrderService.js';
import { AuctionOperations } from '@server/auction/application/AuctionService.js';
import { pruneChatHistory } from '@server/lib/repositories/chatRepository.js';
import {
  runAuctionExpireJob,
  runExpiredDataCleanupJob,
  runMarketRefreshCronJob,
  runMaterialLibraryDailyGenerationJob,
  runRankRewardsJob,
  runResourceReplayCleanupJob,
  runSponsorshipAdminDigestJob,
  runSponsorshipCleanupJob,
  runSponsorshipReconcileJob,
} from '@server/runtime/jobs/internalCron.js';
import { redPacketService } from '@server/social/application/RedPacketService.js';
@Injectable()
export class InternalCronService {
  constructor(
    @Inject(AuctionOperations) private readonly auction: AuctionOperations,
    @Inject(AuctionBuyOrderOperations)
    private readonly buyOrders: AuctionBuyOrderOperations,
  ) {}

  auctionExpire() {
    return runAuctionExpireJob(this.auction, this.buyOrders);
  }
  async chatMaintenance() {
    const packets = await redPacketService.expireDue();
    const messages = await pruneChatHistory();
    return { success: true, processed: packets + messages, skipped: false };
  }
  rankRewards(scheduledAt?: Date) {
    return runRankRewardsJob(scheduledAt);
  }
  marketRefresh() {
    return runMarketRefreshCronJob();
  }
  resourceReplayCleanup() {
    return runResourceReplayCleanupJob();
  }
  expiredDataCleanup() {
    return runExpiredDataCleanupJob();
  }
  materialLibraryGeneration(scheduledAt?: Date) {
    return runMaterialLibraryDailyGenerationJob(scheduledAt);
  }
  sponsorshipReconcile() {
    return runSponsorshipReconcileJob(false);
  }
  sponsorshipDeepReconcile() {
    return runSponsorshipReconcileJob(true);
  }
  sponsorshipCleanup() {
    return runSponsorshipCleanupJob();
  }
  sponsorshipAdminDigest() {
    return runSponsorshipAdminDigestJob();
  }
}
