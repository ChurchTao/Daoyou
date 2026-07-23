import { productionSectRuntime } from '@shared/engine/sect/content';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SectAdmissionApplicationService } from './SectAdmissionApplicationService';
import type {
  SectAdmissionRepository,
  SectTrainingResourceGateway,
} from './ports';

const candidate = { id: 'candidate-1', sectId: 'lingxiao', status: 'prospect' };
const activeState = {
  membershipId: candidate.id,
  sectId: 'lingxiao',
  status: 'active' as const,
  contribution: 30,
  configVersion: 4,
  methods: {},
  paths: [],
  abilityLoadout: [null, null, null, null] as [null, null, null, null],
};

describe('SectAdmissionApplicationService', () => {
  const findMembershipForSect = vi.fn<
    SectAdmissionRepository['findMembershipForSect']
  >(async () => null);
  const findActiveMembership = vi.fn<
    SectAdmissionRepository['findActiveMembership']
  >(async () => null);
  const repository = {
    load: vi.fn(async () => activeState),
    loadForSect: vi.fn(),
    listMemberships: vi.fn(async () => []),
    findActiveMembership,
    findMembershipForSect,
    ensureMembershipCandidate: vi.fn(async () => candidate),
    activateMembership: vi.fn(async () => undefined),
    ensureFacilities: vi.fn(async () => undefined),
  } satisfies SectAdmissionRepository;
  const resources = {
    load: vi.fn(async () => ({
      realm: '炼气' as const,
      stage: '初期' as const,
      stones: 0,
      cultivationExp: 0,
      comprehensionInsight: 0,
      playerRace: 'human' as const,
    })),
  } satisfies Pick<SectTrainingResourceGateway, 'load'>;

  beforeEach(() => vi.clearAllMocks());

  it('creates a candidate and activates it without an admission trial', async () => {
    const service = new SectAdmissionApplicationService(
      productionSectRuntime,
      repository,
      resources,
    );
    await expect(service.join('cultivator-1', 'lingxiao')).resolves.toBe(
      activeState,
    );
    expect(repository.ensureMembershipCandidate).toHaveBeenCalledWith(
      'cultivator-1',
      'lingxiao',
      4,
    );
    expect(repository.activateMembership).toHaveBeenCalledWith(
      candidate.id,
      productionSectRuntime.registry.require('lingxiao').definition,
    );
  });

  it('reuses a legacy prospect instead of creating another record', async () => {
    repository.findMembershipForSect.mockResolvedValueOnce(candidate);
    const service = new SectAdmissionApplicationService(
      productionSectRuntime,
      repository,
      resources,
    );
    await service.join('cultivator-1', 'lingxiao');
    expect(repository.ensureMembershipCandidate).not.toHaveBeenCalled();
    expect(repository.activateMembership).toHaveBeenCalledWith(
      candidate.id,
      expect.anything(),
    );
  });

  it('rejects joining when another sect membership is already active', async () => {
    repository.findActiveMembership.mockResolvedValueOnce({
      id: 'active-elsewhere',
      sectId: 'wuxiang',
      status: 'active',
    });
    const service = new SectAdmissionApplicationService(
      productionSectRuntime,
      repository,
      resources,
    );

    await expect(
      service.join('cultivator-1', 'lingxiao'),
    ).rejects.toMatchObject({ code: 'SECT_ALREADY_JOINED' });
    expect(repository.activateMembership).not.toHaveBeenCalled();
  });

  it('rejects an unknown sect before creating a candidate', async () => {
    const service = new SectAdmissionApplicationService(
      productionSectRuntime,
      repository,
      resources,
    );

    await expect(
      service.join('cultivator-1', 'not-registered'),
    ).rejects.toMatchObject({ code: 'SECT_UNKNOWN' });
    expect(repository.ensureMembershipCandidate).not.toHaveBeenCalled();
  });
});
