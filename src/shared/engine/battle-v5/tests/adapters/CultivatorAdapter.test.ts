import { CultivatorAdapter } from '../../adapters/CultivatorAdapter';
import { Unit } from '../../units/Unit';
import { AttributeType } from '../../core/types';

// Mock Cultivator type
interface MockCultivator {
  id: string;
  name: string;
  attributes: {
    spirit: number;
    vitality: number;
    speed: number;
    wisdom: number;
    willpower: number;
  };
}

describe('CultivatorAdapter', () => {
  it('应该正确映射属性', () => {
    const cultivator: MockCultivator = {
      id: 'test_cultivator',
      name: '测试修仙者',
      attributes: {
        spirit: 80,
        vitality: 60,
        speed: 50,
        wisdom: 40,
        willpower: 30,
      },
    };

    const unit = CultivatorAdapter.toUnit(cultivator);

    expect(unit.attributes.getValue(AttributeType.SPIRIT)).toBe(80);
    expect(unit.attributes.getValue(AttributeType.VITALITY)).toBe(60);
  });

  it('应该创建带镜像后缀的克隆', () => {
    const cultivator: MockCultivator = {
      id: 'test',
      name: '测试',
      attributes: {
        spirit: 50,
        vitality: 50,
        speed: 50,
        wisdom: 50,
        willpower: 50,
      },
    };

    const unit = CultivatorAdapter.toUnit(cultivator, true);
    expect(unit.name).toBe('测试的镜像');
  });

  it('应该正确映射所有5个属性', () => {
    const cultivator: MockCultivator = {
      id: 'test',
      name: '测试',
      attributes: {
        spirit: 100,
        vitality: 80,
        speed: 60,
        wisdom: 40,
        willpower: 20,
      },
    };

    const unit = CultivatorAdapter.toUnit(cultivator);

    expect(unit.attributes.getValue(AttributeType.SPIRIT)).toBe(100);
    expect(unit.attributes.getValue(AttributeType.VITALITY)).toBe(80);
    expect(unit.attributes.getValue(AttributeType.SPEED)).toBe(60);
    expect(unit.attributes.getValue(AttributeType.WISDOM)).toBe(40);
    expect(unit.attributes.getValue(AttributeType.WILLPOWER)).toBe(20);
  });

  it('应该支持批量转换', () => {
    const cultivators: MockCultivator[] = [
      {
        id: 'cultivator1',
        name: '修仙者1',
        attributes: {
          spirit: 50,
          vitality: 50,
          speed: 50,
          wisdom: 50,
          willpower: 50,
        },
      },
      {
        id: 'cultivator2',
        name: '修仙者2',
        attributes: {
          spirit: 60,
          vitality: 60,
          speed: 60,
          wisdom: 60,
          willpower: 60,
        },
      },
    ];

    const units = CultivatorAdapter.toUnits(cultivators);

    expect(units).toHaveLength(2);
    expect(units[0].name).toBe('修仙者1');
    expect(units[1].name).toBe('修仙者2');
    expect(units[0].attributes.getValue(AttributeType.SPIRIT)).toBe(50);
    expect(units[1].attributes.getValue(AttributeType.SPIRIT)).toBe(60);
  });

  it('应该支持批量创建镜像单位', () => {
    const cultivators: MockCultivator[] = [
      {
        id: 'cultivator1',
        name: '修仙者1',
        attributes: {
          spirit: 50,
          vitality: 50,
          speed: 50,
          wisdom: 50,
          willpower: 50,
        },
      },
    ];

    const mirrorUnits = CultivatorAdapter.toUnits(cultivators, true);

    expect(mirrorUnits).toHaveLength(1);
    expect(mirrorUnits[0].name).toBe('修仙者1的镜像');
    expect(mirrorUnits[0].id).toBe('cultivator1_mirror');
  });

  it('镜像单位应该有独立的ID', () => {
    const cultivator: MockCultivator = {
      id: 'original',
      name: '原版',
      attributes: {
        spirit: 50,
        vitality: 50,
        speed: 50,
        wisdom: 50,
        willpower: 50,
      },
    };

    const original = CultivatorAdapter.toUnit(cultivator, false);
    const mirror = CultivatorAdapter.toUnit(cultivator, true);

    expect(original.id).toBe('original');
    expect(mirror.id).toBe('original_mirror');
    expect(original.id).not.toBe(mirror.id);
  });
});
