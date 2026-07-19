import type {
  SectAdmissionContext,
  SectRuntime,
} from '@shared/engine/sect';
import type { Cultivator } from '@shared/types/cultivator';
import { SectError } from '../SectError';
import type {
  SectAdmissionRepository,
  SectTrainingResourceGateway,
} from './ports';

/** Admission use cases. Persistence and transaction ownership stay outside this class. */
export class SectAdmissionApplicationService {
  constructor(
    readonly runtime: SectRuntime,
    private readonly repository: SectAdmissionRepository,
    private readonly resources: Pick<SectTrainingResourceGateway, 'load'>,
  ) {}

  listDefinitions() {
    return this.runtime.registry.listDefinitions();
  }

  listAvailableDefinitions(context: SectAdmissionContext) {
    return this.runtime.registry
      .listDefinitions()
      .filter((definition) =>
        this.runtime.registry.require(definition.id).checkAdmission(context).allowed,
      );
  }

  createTrialScenario(sectId: string, cultivator: Cultivator) {
    const module = this.requireModule(sectId);
    const admission = module.checkAdmission({
      playerRace: cultivator.playerRace ?? 'human',
      realm: cultivator.realm,
      stage: cultivator.realm_stage,
    });
    if (!admission.allowed)
      throw new SectError(
        'SECT_REALM_GATE',
        admission.reason ?? '不符合宗门准入条件',
      );
    return module.createTrialScenario({ cultivator });
  }

  listMemberships(cultivatorId: string) {
    return this.repository.listMemberships(cultivatorId);
  }

  getState(cultivatorId: string) {
    return this.repository.load(cultivatorId);
  }

  getStateForSect(cultivatorId: string, sectId: string) {
    this.requireModule(sectId);
    return this.repository.loadForSect(cultivatorId, sectId);
  }

  async recordExperience(cultivatorId: string, sectId: string) {
    const module = await this.assertAdmission(cultivatorId, sectId);
    const active = await this.repository.findActiveMembership(cultivatorId);
    if (active)
      throw new SectError(
        'SECT_ALREADY_JOINED',
        `已经是${this.runtime.registry.require(active.sectId).definition.name}弟子`,
      );
    await this.repository.recordExperience(
      cultivatorId,
      sectId,
      module.definition.configVersion,
    );
    return (await this.repository.loadForSect(cultivatorId, sectId))!;
  }

  async join(cultivatorId: string, sectId: string) {
    const module = await this.assertAdmission(cultivatorId, sectId);
    const active = await this.repository.findActiveMembership(cultivatorId);
    if (active)
      throw new SectError(
        'SECT_ALREADY_JOINED',
        `已经是${this.runtime.registry.require(active.sectId).definition.name}弟子`,
      );
    const prospect = await this.repository.findMembershipForSect(cultivatorId, sectId);
    if (!prospect?.experiencedAt)
      throw new SectError('SECT_TRIAL_REQUIRED', '须先完成该宗门入门试炼');
    await this.repository.activateMembership(prospect.id, module.definition);
    await this.repository.ensureFacilities(
      sectId,
      module.organization.construction.facilities,
    );
    return (await this.repository.load(cultivatorId))!;
  }

  private requireModule(sectId: string) {
    const module = this.runtime.registry.get(sectId);
    if (!module) throw new SectError('SECT_UNKNOWN', '未知宗门', 400);
    return module;
  }

  private async assertAdmission(cultivatorId: string, sectId: string) {
    const module = this.requireModule(sectId);
    const progress = await this.resources.load(cultivatorId);
    if (!progress) throw new SectError('SECT_REALM_GATE', '角色不存在', 400);
    const result = module.checkAdmission(progress);
    if (!result.allowed)
      throw new SectError(
        'SECT_REALM_GATE',
        result.reason ?? '不符合宗门准入条件',
      );
    return module;
  }
}
