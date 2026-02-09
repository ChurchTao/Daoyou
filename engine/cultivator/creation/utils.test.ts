import { ELEMENT_VALUES } from '@/types/constants';
import { generateSpiritualRoots } from './utils';

describe('generateSpiritualRoots', () => {
  it('filters invalid elements and never outputs values outside ELEMENT_VALUES', () => {
    const roots = generateSpiritualRoots(88, ['无', '火', '火']);

    expect(roots).toHaveLength(1);
    expect(roots[0].element).toBe('火');
    expect(ELEMENT_VALUES).toContain(roots[0].element);
    expect(roots[0].grade).toBe('天灵根');
  });

  it('assigns spiritual root grade by rules', () => {
    const tian = generateSpiritualRoots(95, ['火']);
    const bianyi = generateSpiritualRoots(95, ['雷']);
    const mixedWithMutation = generateSpiritualRoots(85, ['雷', '木']);
    const zhen = generateSpiritualRoots(80, ['金', '木', '水']);
    const wei = generateSpiritualRoots(40, ['金', '木', '水', '火']);

    expect(tian[0].grade).toBe('天灵根');
    expect(bianyi[0].grade).toBe('变异灵根');
    expect(mixedWithMutation.find((root) => root.element === '雷')?.grade).toBe(
      '变异灵根',
    );
    expect(zhen.every((root) => root.grade === '真灵根')).toBe(true);
    expect(wei.every((root) => root.grade === '伪灵根')).toBe(true);
  });

  it('falls back to valid random roots when all preferences are invalid', () => {
    const roots = generateSpiritualRoots(40, ['无', '虚空']);

    expect(roots).toHaveLength(4);
    roots.forEach((root) => {
      expect(ELEMENT_VALUES).toContain(root.element);
      if (root.element === '风' || root.element === '雷' || root.element === '冰') {
        expect(root.grade).toBe('变异灵根');
      } else {
        expect(root.grade).toBe('伪灵根');
      }
    });
  });
});
