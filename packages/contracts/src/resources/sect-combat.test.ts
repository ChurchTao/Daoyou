import { describe, expect, it } from 'vitest';
import { RESOURCE_DATA_SCHEMAS, ResourceChangeSchema } from './test-helpers.js';

const data = {
  schemaVersion: 1,
  status: 'active',
  revision: 3,
  membershipId: 'f7e5d70c-9348-4a44-a306-cb8a69c3bb78',
  sectId: 'wanqiao',
  sectName: '万窍山',
  activePathId: 'wanqiao.path.subtlety',
  meridianDepth: 4,
  methods: ['canon', 'tone', 'undertone', 'rest', 'hollow', 'breath'].map((key, index) => ({
    id: `wanqiao.method.${key}`,
    name: key,
    slot: index + 1,
    level: 80,
    isPrimary: index === 0,
  })),
  paths: [
    { id: 'wanqiao.path.resonance', name: '天籁', description: '众窍相应。' },
    { id: 'wanqiao.path.subtlety', name: '入微', description: '余音入隙。' },
  ],
};

describe('宗门战斗资源契约', () => {
  it('新宗门完整资源与替换事件保留心法、道途和修订号', () => {
    expect(RESOURCE_DATA_SCHEMAS['player.sect-combat'].parse(data)).toEqual(data);
    const event = ResourceChangeSchema.parse({
      id: 'eb3d63a9-e228-4aac-a729-97fd9aee5975',
      mutationOrdinal: 0,
      scope: { kind: 'cultivator', id: 'one' },
      resourceTopic: 'player.sect-combat',
      resourceVersion: 2,
      scopeVersion: 4,
      eventType: 'sect.combat.changed',
      source: 'sect-combat',
      createdAt: '2026-10-31T00:00:00.000Z',
      operation: 'replace',
      payload: data,
    });
    expect(event.payload).toEqual(data);
  });

  it('仍拒绝未知宗门和超出协议上限的心法等级', () => {
    const schema = RESOURCE_DATA_SCHEMAS['player.sect-combat'];
    expect(schema.safeParse({ ...data, sectId: 'unknown-sect' }).success).toBe(false);
    expect(schema.safeParse({
      ...data,
      methods: data.methods.map((method, index) => index === 0 ? { ...method, level: 181 } : method),
    }).success).toBe(false);
  });
});
