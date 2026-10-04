import { Inject, Injectable } from '@nestjs/common';
import { AuctionOperations } from '@server/auction/application/AuctionService.js';
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
@Injectable()
export class InternalCronService {
  constructor(
    @Inject(AuctionOperations) private readonly auction: AuctionOperations,
  ) {}

  auctionExpire() {
    return runAuctionExpireJob(this.auction);
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
