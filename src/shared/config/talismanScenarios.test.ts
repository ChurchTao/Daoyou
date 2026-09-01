import { describe, expect, it } from 'vitest';

import {
  SECT_MERIDIAN_RESET_TALISMAN_SCENARIO,
  isSectMeridianResetTalismanScenario,
} from './sectMeridianResetTalisman';
import {
  TALISMAN_SCENARIO_OPTIONS,
  isTalismanScenario,
} from './talismanScenarios';

describe('talisman scenarios', () => {
  it('provides unique keywords with labels', () => {
    const values = TALISMAN_SCENARIO_OPTIONS.map((option) => option.value);

    expect(new Set(values).size).toBe(values.length);
    expect(
      TALISMAN_SCENARIO_OPTIONS.every(
        (option) => option.value.length > 0 && option.label.length > 0,
      ),
    ).toBe(true);
  });

  it('recognizes only configured keywords', () => {
    for (const option of TALISMAN_SCENARIO_OPTIONS) {
      expect(isTalismanScenario(option.value)).toBe(true);
    }

    expect(isTalismanScenario('custom_scenario')).toBe(false);
    expect(isTalismanScenario('')).toBe(false);
  });

  it('配置洗脉符的流派节点重置场景', () => {
    expect(SECT_MERIDIAN_RESET_TALISMAN_SCENARIO).toBe(
      'sect_meridian_reset',
    );
    expect(
      TALISMAN_SCENARIO_OPTIONS.some(
        (option) => option.value === SECT_MERIDIAN_RESET_TALISMAN_SCENARIO,
      ),
    ).toBe(true);
    expect(
      isSectMeridianResetTalismanScenario(
        SECT_MERIDIAN_RESET_TALISMAN_SCENARIO,
      ),
    ).toBe(true);
    expect(isSectMeridianResetTalismanScenario('sect_transfer')).toBe(false);
  });
});
