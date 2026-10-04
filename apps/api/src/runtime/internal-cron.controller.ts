import { Controller, Get, Inject, UseFilters, UseGuards } from '@nestjs/common';
import { Access } from '../auth/access.js';
import { apiErrorFilter } from '../http/error-filter.js';
import { InternalCronGuard } from './internal-cron.guard.js';
import { InternalCronService } from './internal-cron.service.js';
const CronErrors = apiErrorFilter(() =>
  Response.json(
    { success: false, error: 'Cron job execution failed' },
    { status: 500 },
  ),
);
@Controller('internal/cron')
@Access('public')
@UseGuards(InternalCronGuard)
@UseFilters(CronErrors)
export class InternalCronController {
  constructor(
    @Inject(InternalCronService) private readonly jobs: InternalCronService,
  ) {}
  @Get('auction-expire')
  auctionExpire() {
    return this.jobs.auctionExpire();
  }
  @Get('rank-rewards')
  rankRewards() {
    return this.jobs.rankRewards();
  }
  @Get('market-refresh')
  marketRefresh() {
    return this.jobs.marketRefresh();
  }
  @Get('resource-replay-cleanup')
  resourceReplayCleanup() {
    return this.jobs.resourceReplayCleanup();
  }
  @Get('expired-data-cleanup')
  expiredDataCleanup() {
    return this.jobs.expiredDataCleanup();
  }
  @Get('material-library-daily-generation')
  materialLibraryGeneration() {
    return this.jobs.materialLibraryGeneration();
  }
  @Get('sponsorship-reconcile')
  sponsorshipReconcile() {
    return this.jobs.sponsorshipReconcile();
  }
  @Get('sponsorship-deep-reconcile')
  sponsorshipDeepReconcile() {
    return this.jobs.sponsorshipDeepReconcile();
  }
  @Get('sponsorship-cleanup')
  sponsorshipCleanup() {
    return this.jobs.sponsorshipCleanup();
  }
  @Get('sponsorship-admin-digest')
  sponsorshipAdminDigest() {
    return this.jobs.sponsorshipAdminDigest();
  }
}
