import {
  BACKGROUND_COMMAND_DEFINITIONS,
  BACKGROUND_COMMAND_TYPES,
  parseBackgroundCommandEnvelope,
} from './backgroundCommands.js';

describe('background command contracts', () => {
  it.each(BACKGROUND_COMMAND_TYPES)(
    'keeps %s definition and envelope aligned',
    (type) => {
      const definition = BACKGROUND_COMMAND_DEFINITIONS[type];
      const command = parseBackgroundCommandEnvelope({
        id: '11111111-1111-4111-8111-111111111111',
        type,
        version: definition.version,
        subject: definition.subject,
        requestedAt: '2026-08-03T08:01:00.000Z',
        scheduleBucketStartedAt: '2026-08-03T08:00:00.000Z',
        deduplicationKey: `${type}:2026-08-03T08:00:00.000Z`,
      });

      expect(command).toMatchObject({ type, subject: definition.subject });
    },
  );

  it('rejects a command sent to another subject', () => {
    expect(() =>
      parseBackgroundCommandEnvelope({
        id: '11111111-1111-4111-8111-111111111111',
        type: 'auction.expire',
        version: 1,
        subject: 'daoyou.command.cron.wrong.v1',
        requestedAt: '2026-08-03T08:01:00.000Z',
        scheduleBucketStartedAt: '2026-08-03T08:00:00.000Z',
        deduplicationKey: 'auction.expire:2026-08-03T08:00:00.000Z',
      }),
    ).toThrow('后台命令定义不匹配');
  });
});
