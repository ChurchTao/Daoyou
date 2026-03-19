import { GameplayTagContainer } from '../../core/GameplayTags';
import { GameplayTags } from '../../core/GameplayTags';

describe('标签系统性能测试', () => {
  it('父标签匹配应在 1ms 内完成', () => {
    const container = new GameplayTagContainer();
    container.addTags(['A.B.C.D.E.F']);

    const start = performance.now();
    container.hasTag('A.B.C.D.E.F');
    const end = performance.now();

    expect(end - start).toBeLessThan(1);
  });

  it('大量标签查询不应有明显性能衰减', () => {
    const container = new GameplayTagContainer();
    for (let i = 0; i < 100; i++) {
      container.addTags([`Tag.${i}.A.B.C`]);
    }

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      container.hasTag(`Tag.${Math.floor(Math.random() * 100)}.A`);
    }
    const end = performance.now();

    expect(end - start).toBeLessThan(10);
  });

  it('标签克隆应在合理时间内完成', () => {
    const container = new GameplayTagContainer();
    for (let i = 0; i < 1000; i++) {
      container.addTags([`Tag.${i}.A.B.C`]);
    }

    const start = performance.now();
    const cloned = container.clone();
    const end = performance.now();

    expect(end - start).toBeLessThan(5);
    expect(cloned.getTags().length).toBe(1000);
  });
});
