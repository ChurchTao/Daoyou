import type {
  SectAdmissionContext,
  SectAdmissionResult,
  SectDefinition,
} from '../domain';
import type { SectOrganizationModule } from '../organization';

export interface SectAdmissionPolicy {
  check(context: SectAdmissionContext): SectAdmissionResult;
}

/** 宗门组织与历史进度目录，不装载战斗实现。 */
export interface SectModule {
  readonly definition: SectDefinition;
  readonly organization: SectOrganizationModule;
  checkAdmission(context: SectAdmissionContext): SectAdmissionResult;
}
