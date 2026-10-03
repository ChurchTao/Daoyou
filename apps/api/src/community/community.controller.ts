import { Controller, Get, Inject } from '@nestjs/common';
import { Access } from '../auth/access.js';
import { CommunityService } from './community.service.js';

@Controller('api/community')
@Access('public')
export class CommunityController {
  constructor(
    @Inject(CommunityService) private readonly community: CommunityService,
  ) {}

  @Get('qq-group')
  qqGroup() {
    return this.community.qqGroup();
  }

  @Get('announcement')
  announcement() {
    return this.community.announcement();
  }
}
