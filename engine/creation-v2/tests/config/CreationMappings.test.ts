import {
  ELEMENT_TO_MATERIAL_TAG,
} from '@/engine/creation-v2/config/CreationMappings';
import { ELEMENT_TO_RUNTIME_ABILITY_TAG } from '@/engine/shared/tag-domain';

describe('Creation mappings', () => {
  it('应保证所有元素同时具备 material 与 ability tag 映射', () => {
    const elements = ['金', '木', '水', '火', '土', '风', '雷', '冰'] as const;

    for (const element of elements) {
      expect(ELEMENT_TO_MATERIAL_TAG[element]).toBeTruthy();
      expect(ELEMENT_TO_RUNTIME_ABILITY_TAG[element]).toBeTruthy();
    }
  });

  it('应保证 material 与 ability tag 使用相同元素 token', () => {
    const elements = ['金', '木', '水', '火', '土', '风', '雷', '冰'] as const;

    for (const element of elements) {
      const materialToken = ELEMENT_TO_MATERIAL_TAG[element].split('.').pop();
      const abilityToken = ELEMENT_TO_RUNTIME_ABILITY_TAG[element]
        .split('.')
        .pop();
      expect(materialToken).toBe(abilityToken);
    }
  });
});