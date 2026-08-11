import { getJetStreamClient } from '@server/lib/nats';
import {
  BATTLE_REPLAY_STREAM,
  BATTLE_REPLAY_SUBJECT,
  type BattleReplayArchiveMessageV1,
} from '@shared/contracts/battleReplay';
import { JSONCodec } from 'nats';
import type { RedisBattleBoardgameStorage } from './BattleBoardgameStorage';

const codec = JSONCodec<BattleReplayArchiveMessageV1>();

export async function publishPendingBattleReplays(
  storage: RedisBattleBoardgameStorage,
): Promise<number> {
  const matchIds = await storage.listPendingArchiveMatchIds();
  if (matchIds.length === 0) return 0;
  const jetStream = await getJetStreamClient();
  let published = 0;
  for (const matchId of matchIds) {
    const replay = await storage.getPendingArchive(matchId);
    if (!replay) continue;
    const message: BattleReplayArchiveMessageV1 = {
      version: 'battle_replay_archive_message_v1',
      subject: BATTLE_REPLAY_SUBJECT,
      replay,
    };
    await jetStream.publish(BATTLE_REPLAY_SUBJECT, codec.encode(message), {
      msgID: replay.matchId,
      expect: { streamName: BATTLE_REPLAY_STREAM },
      timeout: 5_000,
    });
    await storage.markArchivePublished(matchId);
    published += 1;
  }
  return published;
}
