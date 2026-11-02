import { describe, expect, it } from 'vitest';
import bailu from './data/bailu-combat.json' with { type: 'json' };
import jiujie from './data/jiujie-combat.json' with { type: 'json' };
import lingxiao from './data/lingxiao-combat.json' with { type: 'json' };
import tianyan from './data/tianyan-skills.json' with { type: 'json' };
import wuxiang from './data/wuxiang-combat.json' with { type: 'json' };
import youdu from './data/youdu-combat.json' with { type: 'json' };
import { COMBAT_V6_SECT_DEFINITIONS, sectStatusDetails } from './registry.js';

const token = /\[\[([a-z0-9_.]+)\]\]/g;
const descriptions = [bailu, jiujie, lingxiao, wuxiang, youdu, tianyan]
  .flatMap((pack) => [
    ...(pack.skills ?? []),
    ...('elemental' in pack ? pack.elemental.map((entry) => entry.skill) : []),
  ])
  .map((skill) => skill.description ?? '');

describe('宗门状态说明引用', () => {
  it('技能文案里的状态标记都能打开对应说明', () => {
    const details = sectStatusDetails();
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
