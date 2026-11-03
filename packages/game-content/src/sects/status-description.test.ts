import { describe, expect, it } from 'vitest';
import bailu from './data/bailu-combat.json' with { type: 'json' };
import jiujie from './data/jiujie-combat.json' with { type: 'json' };
import lingxiao from './data/lingxiao-combat.json' with { type: 'json' };
import tianyan from './data/tianyan-skills.json' with { type: 'json' };
import wanqiao from './data/wanqiao-combat.json' with { type: 'json' };
import wuxiang from './data/wuxiang-combat.json' with { type: 'json' };
import xiaoyue from './data/xiaoyue-combat.json' with { type: 'json' };
import youdu from './data/youdu-combat.json' with { type: 'json' };
import { COMBAT_V6_SECT_DEFINITIONS, sectStatusDetails } from './registry.js';

const token = /\[\[([a-z0-9_.]+)\]\]/g;
const descriptions = [bailu, jiujie, lingxiao, wanqiao, wuxiang, xiaoyue, youdu, tianyan]
  .flatMap((pack) => [
    ...(pack.skills ?? []),
    ...('elemental' in pack ? pack.elemental.map((entry) => entry.skill) : []),
  ])
  .map((skill) => skill.description ?? '');

describe('宗门状态说明引用', () => {
  it('万窍山技能有意象与功效，所有战斗状态均可查看说明', () => {
    for (const skill of wanqiao.skills) {
      const [flavor, effect] = skill.description.split('\n');
      expect(flavor, skill.id).toBeTruthy();
      expect(effect, skill.id).toBeTruthy();
    }
    for (const status of wanqiao.statuses)
      expect(status.description, status.id).toBeTruthy();
  });

  it('技能文案里的状态标记都能打开对应说明', () => {
    const details = sectStatusDetails();
    for (const status of xiaoyue.statuses)
      expect(details[status.id], status.id).toEqual({ name: status.name, description: status.description });
    const referenced = descriptions.flatMap((text) =>
      [...text.matchAll(token)].map((match) => match[1]),
    );
    expect(referenced.length).toBeGreaterThan(0);
    const configured = new Map(
      Object.values(COMBAT_V6_SECT_DEFINITIONS).flatMap((definition) =>
        definition.statuses
          .filter((status) => status.description)
          .map((status) => [status.id, status.description] as const),
      ),
    );
    for (const id of referenced) {
      expect(details[id], id).toEqual({
        name: expect.any(String),
        description: configured.get(id),
      });
    }
  });
});
