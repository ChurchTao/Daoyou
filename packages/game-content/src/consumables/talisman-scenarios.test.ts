import { describe, expect, it } from 'vitest';

import {
  SECT_MERIDIAN_RESET_TALISMAN_SCENARIO,
  isSectMeridianResetTalismanScenario,
} from './sectMeridianResetTalisman.js';
import {
  TALISMAN_SCENARIO_OPTIONS,
  isTalismanScenario,
} from '@daoyou/game-domain/consumables';

describe('talisman scenarios', () => {
  it('does not assign the same keyword to multiple scenarios', () => {
    const values = TALISMAN_SCENARIO_OPTIONS.map((option) => option.value);

    expect(new Set(values).size).toBe(values.length);
  });

  it('rejects arbitrary and empty keywords', () => {
    expect(isTalismanScenario('custom_scenario')).toBe(false);
    expect(isTalismanScenario('')).toBe(false);
  });

  it('配置洗脉符的流派节点重置场景', () => {
    expect(SECT_MERIDIAN_RESET_TALISMAN_SCENARIO).toBe('sect_meridian_reset');
    expect(isTalismanScenario(SECT_MERIDIAN_RESET_TALISMAN_SCENARIO)).toBe(true);
    expect(
      isSectMeridianResetTalismanScenario(
        SECT_MERIDIAN_RESET_TALISMAN_SCENARIO,
      ),
    ).toBe(true);
    expect(isSectMeridianResetTalismanScenario('sect_transfer')).toBe(false);
  });
});
