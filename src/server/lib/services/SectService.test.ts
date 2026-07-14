import type { DbTransaction } from '@server/lib/drizzle/db';
import type { CultivatorSectState } from '@shared/engine/sect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadSectMock, replaceAbilityLoadoutMock } = vi.hoisted(() => ({
  loadSectMock: vi.fn(),
  replaceAbilityLoadoutMock: vi.fn(),
}));

vi.mock('@server/lib/repositories/sectRepository', () => ({
  loadCultivatorSectState: loadSectMock,
  replaceAbilityLoadout: replaceAbilityLoadoutMock,
}));

import { SectService } from './SectService';

const tx = {} as DbTransaction;

function activeSect(): CultivatorSectState {
  return {
    membershipId: 'member-1', sectId: 'lingxiao', status: 'active', contribution: 0,
    tacticId: 'steady', activeMeridianSlot: 1, configVersion: 1,
    methods: { 'lingxiao-canon': 30, 'sword-guidance': 30, 'void-step': 30 },
    meridianLoadouts: [],
    abilityLoadout: ['guiding-sword', 'linked-edge', 'turning-body', null],
  };
}

describe('SectService.setAbilityLoadout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadSectMock.mockResolvedValue(activeSect());
  });

  it('accepts sparse fixed slots and preserves their positions', async () => {
    await expect(SectService.setAbilityLoadout(
      'cultivator-1',
      ['guiding-sword', null, 'turning-body', null],
      tx,
    )).resolves.toMatchObject({ membershipId: 'member-1' });

    expect(replaceAbilityLoadoutMock).toHaveBeenCalledWith(
      'member-1',
      ['guiding-sword', null, 'turning-body', null],
      tx,
    );
  });

  it.each([
    [['guiding-sword', null, null]],
    [['guiding-sword', null, 'guiding-sword', null]],
    [['plain-sword', null, null, null]],
    [['breaking-edge', null, null, null]],
  ])('rejects invalid, duplicate, default or locked slots: %j', async (slots) => {
    await expect(SectService.setAbilityLoadout(
      'cultivator-1',
      slots,
      tx,
    )).rejects.toMatchObject({ code: 'SECT_INVALID_LOADOUT' });
    expect(replaceAbilityLoadoutMock).not.toHaveBeenCalled();
  });
});
