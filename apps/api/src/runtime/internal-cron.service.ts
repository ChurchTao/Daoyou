import { Injectable } from '@nestjs/common';
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
  auctionExpire() {
    return runAuctionExpireJob();
  }
  rankRewards() {
    return runRankRewardsJob();
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
  materialLibraryGeneration() {
    return runMaterialLibraryDailyGenerationJob();
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
