import type {
  PlayerRaceId,
  SectAdmissionContext,
  SectAdmissionResult,
} from '../domain';
import type { SectAdmissionPolicy } from './contracts';

/** 通用种族准入策略；拒绝文案由宗门内容提供。 */
export class AllowedRaceAdmissionPolicy implements SectAdmissionPolicy {
  constructor(
    private readonly allowedRaceIds: readonly PlayerRaceId[],
    private readonly rejectedReason: string,
  ) {}

  check(context: SectAdmissionContext): SectAdmissionResult {
    return this.allowedRaceIds.includes(context.playerRace)
      ? { allowed: true }
      : { allowed: false, reason: this.rejectedReason };
  }
}
