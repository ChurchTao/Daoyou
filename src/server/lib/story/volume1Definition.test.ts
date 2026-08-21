import {
  applyFlagPatch,
  applyTrustDelta,
  buildExpectedScene,
  buildStoryContinuation,
  createInitialStoryProgress,
  resolveStoryChoice,
  routeAllowsExpectedScene,
  type StoryActorContext,
  type StoryProgressState,
} from '@server/lib/story/volume1Definition';
import { describe, expect, it } from 'vitest';

const actor: StoryActorContext = {
  cultivatorId: '00000000-0000-4000-8000-000000000001',
  playerName: '试剑人',
  realm: '炼气',
  sectId: 'lingxiao',
};

function advance(
  progress: StoryProgressState,
  choiceId: string,
  actorOverride: Partial<StoryActorContext> = {},
) {
  const currentActor = { ...actor, ...actorOverride };
  const scene = buildExpectedScene(progress, currentActor);
  if (!scene) throw new Error('expected scene');
  const transition = resolveStoryChoice(
    progress,
    currentActor,
    scene.sceneKey,
    choiceId,
  );
  return {
    ...progress,
    status: transition.status ?? progress.status,
    currentNodeId: transition.nodeId,
    currentStep: transition.step,
    flags: applyFlagPatch(progress.flags, transition.setFlags),
    npcTrust: applyTrustDelta(progress.npcTrust, transition.trustDelta),
    completedAt: transition.completed ? new Date() : progress.completedAt,
  } satisfies StoryProgressState;
}

describe('第一卷主线定义 V1.2 原生融合兼容层', () => {
  it('执事堂结束后直接生成前往药田的承接，不依赖任务中心', () => {
    let progress = createInitialStoryProgress();
    expect(routeAllowsExpectedScene(progress, '/game/sect/affairs')).toBe(true);
    progress = advance(progress, 'continue');
    const continuation = buildStoryContinuation(progress, actor);
    expect(progress.currentStep).toBe('herb');
    expect(continuation?.kind).toBe('travel');
    expect(continuation?.action?.href).toBe('/game/sect/herb-garden');
  });

  it('山门正常参照结束后以“第二日”自然承接异草', () => {
    let progress = createInitialStoryProgress();
    progress = advance(progress, 'continue');
    progress = advance(progress, 'continue');
    progress = advance(progress, 'continue');
    const continuation = buildStoryContinuation(progress, actor);
    expect(progress.currentNodeId).toBe('01-01');
    expect(progress.flags['story.v1.prologue_done']).toBe(true);
    expect(continuation?.title).toBe('第二日');
    expect(continuation?.action?.href).toBe('/game/sect/herb-garden');
  });

  it('01-01 选择单独写入剧情 flags，不污染通用任务', () => {
    let progress: StoryProgressState = {
      ...createInitialStoryProgress(),
      currentNodeId: '01-01',
      currentStep: 'root',
    };
    progress = advance(progress, 'handover');
    expect(progress.flags['story.v1.root_anomaly_seen']).toBe(true);
    expect(progress.flags['story.v1.root_sample_choice']).toBe('handover');
    expect(progress.npcTrust['秦晚晴']).toBe(1);
    expect(buildStoryContinuation(progress, actor)?.action?.href).toBe(
      '/game/sect/archive',
    );
  });

  it('青溪残页选择先问老者时真的进入黑市支线，再回档案室', () => {
    let progress: StoryProgressState = {
      ...createInitialStoryProgress(),
      currentNodeId: '01-07',
      currentStep: 'found-page',
      flags: { 'story.v1.black_fragment_owned': true },
    };
    progress = advance(progress, 'elder');
    expect(progress.currentNodeId).toBe('01-07');
    expect(progress.currentStep).toBe('elder-check');
    expect(buildStoryContinuation(progress, actor)?.action?.href).toBe(
      '/game/black-market',
    );
    progress = advance(progress, 'back');
    expect(progress.currentNodeId).toBe('01-08');
    expect(progress.currentStep).toBe('letters');
  });

  it('青溪残页选择坊市鉴定时进入现有鉴宝司场景', () => {
    let progress: StoryProgressState = {
      ...createInitialStoryProgress(),
      currentNodeId: '01-07',
      currentStep: 'found-page',
    };
    progress = advance(progress, 'sell');
    expect(progress.currentStep).toBe('market-check');
    expect(routeAllowsExpectedScene(progress, '/game/market/recycle')).toBe(true);
    progress = advance(progress, 'back');
    expect(progress.currentStep).toBe('letters');
  });

  it('夜半山门的选择枚举统一为 follow/report/lock', () => {
    const progress: StoryProgressState = {
      ...createInitialStoryProgress(),
      currentNodeId: '01-09',
      currentStep: 'gate',
    };
    const scene = buildExpectedScene(progress, actor)!;
    expect(scene.choices.map((item) => item.id)).toEqual([
      'follow',
      'report',
      'lock',
    ]);
  });

  it('已筑基旧角色到 01-10 时直接进入声音，不会卡死', () => {
    let progress: StoryProgressState = {
      ...createInitialStoryProgress(),
      currentNodeId: '01-10',
      currentStep: 'pre-breakthrough',
    };
    progress = advance(progress, 'enter', { realm: '筑基' });
    expect(progress.currentStep).toBe('voice');
  });

  it('听见“有人吗”后不会直接完卷，必须回守档者处完成收束', () => {
    let progress: StoryProgressState = {
      ...createInitialStoryProgress(),
      currentNodeId: '01-10',
      currentStep: 'voice',
    };
    progress = advance(progress, 'listen', { realm: '筑基' });
    expect(progress.status).toBe('active');
    expect(progress.currentStep).toBe('report');
    expect(progress.flags['story.v1.first_voice_heard']).toBe(true);
    expect(buildStoryContinuation(progress, { ...actor, realm: '筑基' })?.action?.href).toBe(
      '/game/sect/archive',
    );
    progress = advance(progress, 'finish', { realm: '筑基' });
    expect(progress.status).toBe('completed');
  });

  it('黑市买下石片只记录剧情持有状态', () => {
    let progress: StoryProgressState = {
      ...createInitialStoryProgress(),
      currentNodeId: '01-05',
      currentStep: 'black-market',
    };
    progress = advance(progress, 'buy');
    expect(progress.flags['story.v1.black_fragment_owned']).toBe(true);
    expect(progress.currentNodeId).toBe('01-06');
  });
});
