import { describe, expect, it } from 'vitest';
import {
  canAdvanceStoryStage,
  deriveStoryArchiveProgress,
  DungeonStoryContextSchema,
  isDeadStoryEntityMentionHistorical,
  isStoryAftermathNarrationConsistent,
  isStoryOmenIntroductionConsistent,
  isStoryTerminalNarrativeResolved,
  selectRelevantStoryMemories,
  storyChoiceLaunchRules,
  StoryOmenGenerationSchema,
} from './personalStory';

describe('personal story rules', () => {
  it('only allows the confirmed forward stage sequence', () => {
    expect(canAdvanceStoryStage('omen', 'choice')).toBe(true);
    expect(canAdvanceStoryStage('choice', 'travel_prelude')).toBe(true);
    expect(canAdvanceStoryStage('travel_prelude', 'confrontation')).toBe(true);
    expect(canAdvanceStoryStage('confrontation', 'aftermath')).toBe(true);
    expect(canAdvanceStoryStage('aftermath', 'resolved')).toBe(true);
    expect(canAdvanceStoryStage('choice', 'aftermath')).toBe(false);
    expect(canAdvanceStoryStage('choice', 'confrontation')).toBe(false);
    expect(canAdvanceStoryStage('resolved', 'omen')).toBe(false);
  });

  it('maps player choices to server-owned dungeon conditions', () => {
    expect(storyChoiceLaunchRules('intervene_now')).toEqual({
      entryMode: 'direct',
      initialDangerAdjustment: 10,
      entryAdvantage: 'initiative',
      entryConsequence: 'higher_danger',
    });
    expect(storyChoiceLaunchRules('investigate_first')).toEqual({
      entryMode: 'investigated',
      initialDangerAdjustment: -5,
      entryAdvantage: 'prepared_clue',
      entryConsequence: 'target_prepared',
    });
    expect(storyChoiceLaunchRules('delay')).toEqual({
      entryMode: null,
      initialDangerAdjustment: 0,
    });
  });

  it('rejects missing or duplicate stable choice keys', () => {
    const base = {
      title: '一封染血的旧信',
      content:
        '你认出信上的印记来自旧日秘境。寄信人并未声称你已答应，只说那道封印正在松动，等待你的决定。',
      premise: '旧日秘境中被忽略的封印再次松动。',
      unresolvedQuestion: '封印之后究竟是谁在等待？',
      memoryRefs: ['00000000-0000-4000-8000-000000000001'],
      continuityClaims: ['只引用了输入中的秘境经历'],
      entity: {
        name: '闻鹤生',
        entityType: 'person',
        state: '带伤失踪，只留下求援信',
        relationship: 'unknown',
        introductionMode: 'unverified_claimant',
      },
    };
    const invalid = StoryOmenGenerationSchema.safeParse({
      ...base,
      choices: [
        {
          key: 'intervene_now',
          label: '立即介入',
          description: '立刻赴约',
        },
        {
          key: 'intervene_now',
          label: '再度介入',
          description: '仍旧立刻赴约',
        },
      ],
    });
    expect(invalid.success).toBe(false);
  });

  it('只允许未证实的新人物以自称故人开场', () => {
    expect(
      isStoryOmenIntroductionConsistent({
        content: '来人自称是你多年未见的故人，但你并无印象。',
        introductionMode: 'unverified_claimant',
        relationship: 'unknown',
      }),
    ).toBe(true);
    expect(
      isStoryOmenIntroductionConsistent({
        content: '多年未见的故人再次来信，追问当年共许的诺言。',
        introductionMode: 'unverified_claimant',
        relationship: 'unknown',
      }),
    ).toBe(false);
  });

  it('已死亡实体不能再以本人身份回信或嘱咐', () => {
    expect(
      isStoryAftermathNarrationConsistent({
        content: '无名故人又寄来回信，提醒你往后注意安全。',
        entityName: '无名故人',
        lifeStatus: 'dead',
        narratorMode: 'entity_letter',
      }),
    ).toBe(false);
    expect(
      isStoryAftermathNarrationConsistent({
        content: '战斗记录确认，无名故人已在秘境中死亡。',
        entityName: '无名故人',
        lifeStatus: 'dead',
        narratorMode: 'system_record',
      }),
    ).toBe(true);
    expect(
      isDeadStoryEntityMentionHistorical(
        '无名故人已死，他生前遗留的断旗再度现身。',
        '无名故人',
      ),
    ).toBe(true);
    expect(
      isDeadStoryEntityMentionHistorical(
        '无名故人此刻寄来新信，等你赴约。',
        '无名故人',
      ),
    ).toBe(false);
  });

  it('只选入与新触发记忆共享具体标签的旧剧情', () => {
    const trigger = {
      summary: '玩家再次进入寒潭石洞。',
      tags: ['秘境', '寒潭石洞', '完成'],
    };
    const relevant = {
      summary: '旧日线索与寒潭石洞有关。',
      tags: ['个人剧情', '寒潭石洞'],
    };
    const unrelated = {
      summary: '无名故人死于别处。',
      tags: ['个人剧情', '赤炎山'],
    };
    expect(selectRelevantStoryMemories(trigger, [unrelated, relevant])).toEqual(
      [relevant],
    );
  });

  it('不把踏入新区域当成个人剧情结局', () => {
    expect(
      isStoryTerminalNarrativeResolved(
        '你推开石门，踏入核心区域，门后仍待探索。',
      ),
    ).toBe(false);
    expect(
      isStoryTerminalNarrativeResolved(
        '你踏入核心区域，查明异动来源并关闭了旧封。',
      ),
    ).toBe(true);
  });

  it('把剧情线权威状态投影成可复盘的当前进度', () => {
    expect(
      deriveStoryArchiveProgress({
        stage: 'omen',
        status: 'active',
      }),
    ).toMatchObject({ key: 'awaiting_delivery', stepIndex: 1 });
    expect(
      deriveStoryArchiveProgress({
        stage: 'choice',
        status: 'active',
      }),
    ).toMatchObject({ key: 'awaiting_choice', stepIndex: 2 });
    expect(
      deriveStoryArchiveProgress({
        stage: 'travel_prelude',
        status: 'active',
      }),
    ).toMatchObject({ key: 'awaiting_travel_prelude', stepIndex: 3 });
    expect(
      deriveStoryArchiveProgress({
        stage: 'confrontation',
        status: 'active',
      }),
    ).toMatchObject({ key: 'ready_to_start', stepIndex: 4 });
    expect(
      deriveStoryArchiveProgress({
        stage: 'confrontation',
        status: 'active',
        linkedRunId: '00000000-0000-4000-8000-000000000001',
        linkedRunStatus: 'IN_BATTLE',
      }),
    ).toMatchObject({ key: 'in_dungeon', stepIndex: 4 });
    expect(
      deriveStoryArchiveProgress({
        stage: 'confrontation',
        status: 'active',
        linkedRunId: '00000000-0000-4000-8000-000000000001',
        linkedRunStatus: 'FINISHED',
      }),
    ).toMatchObject({ key: 'awaiting_echo', stepIndex: 5 });
    expect(
      deriveStoryArchiveProgress({
        stage: 'resolved',
        status: 'resolved',
      }),
    ).toMatchObject({ key: 'resolved', stepIndex: 5 });
  });

  it('distinguishes dynamic anomaly dungeons from personal story threads', () => {
    const context = DungeonStoryContextSchema.parse({
      sourceType: 'activity_story',
      activityIntentId: '00000000-0000-4000-8000-000000000001',
      rootActivityId: 'travel:00000000-0000-4000-8000-000000000009',
      intentId: '00000000-0000-4000-8000-000000000001',
      frameworkId: 'activity_story',
      title: '山痕暗径',
      premise: '山道异闻留下的刻痕伸入山腹，并与玩家旧日记忆发生呼应。',
      choiceKey: 'approach_carefully',
      entryMode: 'investigated',
      objective: '查明刻痕源头并处理阻路威胁。',
      openingHook: '玩家循安全侧缝进入山腹，旧痕在黑暗中逐段显露。',
      primaryClue: '山腹深处的新刻痕',
      initialDangerAdjustment: -5,
      entryAdvantage: 'prepared_clue',
      entryConsequence: 'target_prepared',
      travelChoiceKey: 'approach_carefully',
      travelOutcome: '玩家已经核对旧痕并找到了安全入口。',
      travelDangerAdjustment: -5,
      requiresBattle: true,
    });

    expect(context.threadId).toBeUndefined();
    expect(context.requiresBattle).toBe(true);
    expect(context.sourceType).toBe('activity_story');
    expect(context.rootActivityId).toBe(
      'travel:00000000-0000-4000-8000-000000000009',
    );
  });
});
