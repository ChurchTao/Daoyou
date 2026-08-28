import { renderPrompt } from '@server/lib/prompts';
import { generateAiObject } from '@server/utils/aiClient';
import { stableCompactStringify, truncateText } from '@server/utils/llmPayload';
import { PAST_ECHOES_FRAMEWORK } from '@shared/lib/story/pastEchoes';
import {
  STORY_LAUNCH_CHOICE_KEY_VALUES,
  StoryAftermathGenerationSchema,
  StoryDungeonBlueprintSchema,
  StoryMemoryGenerationSchema,
  StoryOmenGenerationSchema,
  isDeadStoryEntityMentionHistorical,
  isStoryAftermathNarrationConsistent,
  isStoryOmenIntroductionConsistent,
  type StoryChoice,
  type StoryChoiceKey,
} from '@shared/lib/story/personalStory';
import {
  TravelStoryGenerationSchema,
  type TravelStoryGeneration,
} from '@shared/lib/story/travelStory';
import type {
  StoryAftermathGenerationResult,
  StoryAftermathPolicy,
  StoryBlueprintGenerationResult,
  StoryDungeonTriggerContext,
  StoryMemoryGenerationResult,
  StoryMemoryReference,
  StoryOmenGenerationResult,
  StoryRelatedEntityReference,
  StoryThreadGenerationContext,
  TravelStoryGenerationLinkageContext,
  TravelStoryGenerationResult,
  TravelStoryTriggerContext,
} from './types';

const STORY_LLM_TIMEOUT_MS = 45_000;
const TRAVEL_STORY_FORBIDDEN_NARRATIVE =
  /(?:\d+\s*(?:灵石|点修为|点感悟)|获得|拾得|收起|带走).{0,24}(?:丹|功法|玉简|法宝|法器|灵草|矿|材料|妖丹)|(?:击杀|斩杀|杀死|伏诛|战胜)/u;

function errorMessage(error: unknown): string {
  return truncateText(
    error instanceof Error ? error.message : String(error),
    800,
  );
}

function standardChoices(): StoryChoice[] {
  return [
    {
      key: 'intervene_now',
      label: '立即介入',
      description: '不再等待，循信中留下的痕迹立刻前往。',
    },
    {
      key: 'investigate_first',
      label: '先行调查',
      description: '先核对旧事与线索，再进入异常之地。',
    },
  ];
}

function authoritativeRunPayload(context: StoryDungeonTriggerContext) {
  return {
    cultivator: context.cultivator,
    dungeon: {
      runId: context.run.id,
      mapNodeId: context.run.mapNodeId,
      theme: context.run.theme,
      outcome: context.run.outcome,
      endingNarrative: context.run.endingNarrative
        ? truncateText(context.run.endingNarrative, 500)
        : null,
      recentHistory: context.run.history.slice(-5).map((entry) => ({
        round: entry.round,
        scene: truncateText(entry.scene, 240),
        choice: entry.choice ? truncateText(entry.choice, 120) : null,
        outcome: entry.outcome ? truncateText(entry.outcome, 200) : null,
        gainedItems: entry.gainedItems?.slice(0, 6) ?? [],
      })),
      defeatedEnemyNames: context.run.defeatedEnemyNames,
      accumulatedRewards: context.run.accumulatedRewards,
      storyContext: context.run.storyContext ?? null,
    },
    occurredAt: context.occurredAt,
  };
}

function fallbackMemory(
  context: StoryDungeonTriggerContext,
): StoryMemoryGenerationResult['output'] {
  const outcomeText =
    context.run.outcome === 'completed'
      ? '完成探索并平安离开'
      : context.run.outcome === 'retreated_after_battle'
        ? '在交锋后选择撤离'
        : '在交锋前放弃深入';
  const story = context.run.storyContext;
  const linkedCause = story
    ? `因“${truncateText(story.travelOutcome, 72)}”进入【${story.title}】，围绕“${truncateText(story.objective, 60)}”`
    : `曾进入${context.run.theme}，`;
  return {
    summary: `${context.cultivator.name}${linkedCause}${outcomeText}。`,
    tags: [
      '秘境',
      ...(story
        ? [story.sourceType === 'activity_story' ? '动态异闻' : '个人剧情']
        : []),
      (story?.title ?? context.run.theme).slice(0, 20),
      context.run.outcome === 'completed' ? '完成' : '撤离',
    ],
    importance: context.run.outcome === 'completed' ? 2 : 3,
  };
}

function fallbackOmen(
  context: StoryDungeonTriggerContext,
  memory: StoryMemoryReference,
): StoryOmenGenerationResult['output'] {
  return {
    title: '《前尘回响·旧痕来信》',
    content: `一封没有署名的旧札被送到你的洞府。纸上残留的气息，与${context.run.theme}如出一辙。来信者自称曾在那处入口外见过你，又写道：“你或许已经不记得我。”你对此并无确切印象，只能确认信中所指的旧地确实存在。\n\n旧札没有替你许下承诺，只留下重返旧地的方位，等你自行决断。`,
    premise: `${context.run.theme}中一处未被察觉的旧封印重新出现异动。`,
    unresolvedQuestion: '封印异动为何只在此时循着旧日气息找上玩家？',
    memoryRefs: [memory.id],
    continuityClaims: [`来信只引用了记忆：${memory.summary}`],
    entity: {
      name: '自称旧识的来客',
      entityType: 'person',
      state: '身份和过往关系均未证实，以一封旧札留下线索',
      relationship: 'unknown',
      introductionMode: 'unverified_claimant',
    },
    choices: standardChoices(),
  };
}

function fallbackBlueprint(
  memory: StoryMemoryReference,
  thread: StoryThreadGenerationContext,
  choiceKey: Exclude<StoryChoiceKey, 'delay'>,
): StoryBlueprintGenerationResult['output'] {
  const investigated = choiceKey === 'investigate_first';
  return {
    title: investigated ? '循痕复勘' : '旧地急行',
    theme: `${thread.premise}，旧日场景因玩家的再次到来发生偏移。`,
    objective: '找到异动源头，并确认守痕人的真实处境。',
    openingHook: investigated
      ? `你先比对了旧札与记忆中的细节，确认入口附近有一道被刻意遮掩的回返印记。${memory.summary}`
      : `你循着旧札留下的微弱气息立即赶到入口，异动已经越过最初的封锁。${memory.summary}`,
    primaryClue: investigated ? '被遮掩的回返印记' : '正在扩散的旧封气息',
    dangerTone: investigated ? 'cautious' : 'urgent',
  };
}

function fallbackAftermath(
  context: StoryDungeonTriggerContext,
  thread: StoryThreadGenerationContext,
  policy: StoryAftermathPolicy,
): StoryAftermathGenerationResult['output'] {
  const completed = context.run.outcome === 'completed';
  const choiceText =
    thread.selectedChoiceKey === 'investigate_first' ? '先行调查' : '立即介入';
  const entityName = thread.entity?.name ?? '来信者';
  const content = policy.entityDefeated
    ? `你以“${choiceText}”进入关联秘境。现场残留的斗法痕迹足以确认：${entityName}在此行中被你击败并死亡。此后没有新的回信，也没有来自死者的嘱咐；这段纪录只保留你真实做出的选择与结果。`
    : completed
      ? `你以“${choiceText}”作出回应，并完成了这次关联探索。数日后，${entityName}寄来回书，只确认这段旧事已按秘境中的真实结果收束，信中没有附带任何报酬。`
      : `你以“${choiceText}”作出回应，但未在这次关联探索中完成最初目标。${entityName}的处境并未因此被臆测为安全，这一次只记为未竟的尝试。`;
  return {
    title: policy.entityDefeated
      ? '《前尘回响·归档》'
      : '《前尘回响·事后回书》',
    content,
    memorySummary: `${context.cultivator.name}选择${choiceText}处理${thread.premise}，关联秘境最终以${context.run.outcome}结束。`,
    entityState: policy.entityDefeated
      ? '在关联秘境中被玩家击败，死亡结果已确认'
      : completed
        ? '确认玩家处理了当前异动，暂时保持联络'
        : '处境未明，当前目标尚未完成',
    relationship: policy.entityDefeated
      ? 'hostile'
      : completed
        ? 'trusting'
        : 'wary',
    resolutionStatus: policy.resolutionStatus,
    narratorMode: policy.narratorMode,
    nextHook: policy.entityDefeated
      ? ''
      : completed
        ? `${entityName}自称的过往仍未得到独立证实。`
        : '当前目标尚未完成，但只有后续事件与此线索相关时才会再次提及。',
    continuityClaims: [
      `玩家已确认选择：${thread.selectedChoiceKey ?? '未知'}`,
      `关联秘境真实结果：${context.run.outcome}`,
    ],
  };
}

function fallbackTravelStory(
  context: TravelStoryTriggerContext,
  memories: StoryMemoryReference[],
  linkage?: TravelStoryGenerationLinkageContext,
): TravelStoryGeneration {
  if (linkage?.kind === 'mainline_prelude') {
    return {
      eventType: 'memory_echo',
      title: '旧信所指的山痕',
      content: `${context.cultivator.name}循着信中方位外出查验，在山道转折处发现一道与【${linkage.thread.premise.slice(0, 48)}】相合的残痕。它既能作为进入关联秘境前的引路线索，也可能是刻意留下的诱饵。`,
      memoryRefs: memories[0] ? [memories[0].id] : [],
      entityRefs: linkage.thread.entity ? [linkage.thread.entity.id] : [],
      continuityClaims: [
        `本次途中线索来自当前主线：${linkage.authoritativeSummary}`,
      ],
      choices: [
        {
          key: 'approach_carefully',
          label: '沿痕复勘',
          description: '先比对地形与旧痕，确认安全路径后再动身。',
          outcome:
            '你没有立刻踏入异动最强之处，而是沿外围逐段复勘。数处伪痕被排除，一条更安全的进入路线也由此显露。',
          memorySummary: `${context.cultivator.name}在进入关联秘境前谨慎复勘旧痕，确认了一条更安全的路径。`,
          tags: ['云游', '主线联动', '谨慎'],
          rewardKind: 'comprehension_insight',
        },
        {
          key: 'act_decisively',
          label: '截取先机',
          description: '趁异动尚未扩散，直接追向最清晰的痕迹。',
          outcome:
            '你抢在痕迹彻底消散前追至入口，确认了关联秘境的准确方位，也让潜伏其中的存在提前察觉到你的到来。',
          memorySummary: `${context.cultivator.name}在进入关联秘境前果断追踪旧痕，以更高风险换取了先机。`,
          tags: ['云游', '主线联动', '果断'],
          rewardKind: 'cultivation_exp',
        },
      ],
    };
  }
  if (linkage?.kind === 'mainline_echo') {
    return {
      eventType: 'memory_echo',
      title: '旧事迟来的回声',
      content: `${context.cultivator.name}再次经过一段熟悉山路时，秘境中留下的气息终于显出回应。${linkage.authoritativeSummary}。这并非新的战斗，而是决定如何记下此事的最后一步。`,
      memoryRefs: memories[0] ? [memories[0].id] : [],
      entityRefs: linkage.thread.entity ? [linkage.thread.entity.id] : [],
      continuityClaims: [
        `回响只承接已确认的秘境结算：${linkage.authoritativeSummary}`,
      ],
      choices: [
        {
          key: 'approach_carefully',
          label: '留痕归档',
          description: '逐一核对回声与旧事，把能够确认的部分记入纪事。',
          outcome:
            '你将回声与沿途痕迹逐一核对，只留下能够被秘境结果证实的事实。这段旧事至此有了清晰边界。',
          memorySummary: `${context.cultivator.name}谨慎核对秘境回响，将主线旧事如实归档。`,
          tags: ['云游', '延迟回响', '归档'],
          rewardKind: 'comprehension_insight',
        },
        {
          key: 'act_decisively',
          label: '斩断余念',
          description: '不再追逐无法证实的细节，以当前结局斩断余念。',
          outcome:
            '你不再让含混的回声牵引脚步，只承认已经发生的选择与结局。山风散去，这一章也随之收束。',
          memorySummary: `${context.cultivator.name}以秘境的真实结局斩断余念，收束了当前主线。`,
          tags: ['云游', '延迟回响', '收束'],
          rewardKind: 'cultivation_exp',
        },
      ],
    };
  }
  if (context.journey.activityType === 'sect_task') {
    const title = context.journey.title ?? '宗门委托';
    const summary = context.journey.summary ?? `${title}已经完成。`;
    return {
      eventType: 'memory_echo',
      title: `${title}·复命余响`,
      content: `${context.cultivator.name}完成【${title}】后回到宗门复命。${summary}执事将经过录入册中，只有一处细节尚值得你留下怎样的批注。`,
      memoryRefs: memories[0] ? [memories[0].id] : [],
      entityRefs: [],
      continuityClaims: [`本次回响只承接已完成任务：${summary}`],
      choices: [
        {
          key: 'approach_carefully',
          label: '如实录册',
          description: '只记录能够由任务结果证明的经过。',
          outcome:
            '你删去了推测与夸大之语，只将任务中确已发生的细节录入册中。这份记录不显眼，却足够可靠。',
          memorySummary: `${context.cultivator.name}完成【${title}】后选择如实记录任务经过。`,
          tags: ['宗门任务', '复命', '谨慎'],
          rewardKind: 'comprehension_insight',
        },
        {
          key: 'act_decisively',
          label: '标记余痕',
          description: '将最值得留意的细节标成后续可查的余痕。',
          outcome:
            '你没有将余痕写成新任务，只在卷宗上留下一枚醒目批注。若将来再有权威事件与之呼应，它才会重新显现。',
          memorySummary: `${context.cultivator.name}完成【${title}】后为一处未明细节留下余痕标记。`,
          tags: ['宗门任务', '复命', '果断'],
          rewardKind: 'cultivation_exp',
        },
      ],
    };
  }
  if (context.journey.activityType === 'dungeon') {
    const title = context.journey.title ?? '秘境探索';
    const summary = context.journey.summary ?? `${title}已经结算。`;
    return {
      eventType: 'memory_echo',
      title: `${title}·归途余痕`,
      content: `${context.cultivator.name}离开【${title}】后，一缕未散的气息仍随衣角而行。${summary}它不会改写此行结果，只等你决定如何记下。`,
      memoryRefs: memories[0] ? [memories[0].id] : [],
      entityRefs: [],
      continuityClaims: [`本次余痕只承接秘境结算：${summary}`],
      choices: [
        {
          key: 'approach_carefully',
          label: '核对此行',
          description: '对照所得与损耗，把可确认的事实整理成册。',
          outcome:
            '你将此行的选择与结算逐一核对，未被证实的猜想被排除，只留下一份清晰纪录。',
          memorySummary: `${context.cultivator.name}离开【${title}】后谨慎核对并归档了此行结果。`,
          tags: ['普通秘境', '归途', '谨慎'],
          rewardKind: 'comprehension_insight',
        },
        {
          key: 'act_decisively',
          label: '留印前行',
          description: '留下必要标记，不再为已结算的危险停步。',
          outcome:
            '你留下一枚只有自己认得的印记，随即斩断余念离去。此行结果没有变化，脚步却更加坚定。',
          memorySummary: `${context.cultivator.name}离开【${title}】后果断留印，不再追逐未证实的余音。`,
          tags: ['普通秘境', '归途', '果断'],
          rewardKind: 'cultivation_exp',
        },
      ],
    };
  }
  const memory = memories[0];
  const oldTrace = memory
    ? `那痕迹与你记忆中的【${memory.summary.slice(0, 36)}】隐有呼应`
    : '那痕迹既不像寻常野兽所留，也无明显法力波动';
  return {
    eventType: memory ? 'memory_echo' : 'wild_omen',
    title: '山道旧痕',
    content: `${context.cultivator.name}归途经过一处被雨水冲开的旧山道，崖壁上露出一枚已近风化的刻痕。${oldTrace}。天色渐暗，这点异样只够你做一次短暂查验。`,
    memoryRefs: memory ? [memory.id] : [],
    entityRefs: [],
    continuityClaims: memory ? [`当前异闻只引用旧记忆：${memory.summary}`] : [],
    choices: [
      {
        key: 'approach_carefully',
        label: '审痕记路',
        description: '先核对刻痕与旧记忆，再沿安全路径进入痕迹源头。',
        outcome:
          '你拂去崖壁浮泥，将刻痕与旧记忆逐一比对，辨出一条被坍石遮掩的安全入口。痕迹源头仍在深处，需进入关联秘境才能查明。',
        memorySummary: `${context.cultivator.name}在历练归途谨慎辨出山道旧痕所指的秘境入口。`,
        tags: ['云游', '山道', '谨慎'],
        rewardKind: 'comprehension_insight',
        dungeonBlueprint: {
          title: '山痕暗径',
          theme: `${oldTrace}，被雨水冲开的山腹暗径中仍有新的痕迹延伸。`,
          objective: '进入山腹查明旧刻痕的来历，并处理守在痕迹源头的威胁。',
          openingHook:
            '你按记录避开松动岩层，从一条狭窄侧缝进入山腹；旧刻痕在黑暗中逐段显露。',
          primaryClue: '山腹深处延续的新刻痕',
          dangerTone: 'cautious',
        },
      },
      {
        key: 'act_decisively',
        label: '入缝查看',
        description: '趁痕迹尚未消散，破开岩缝直追源头。',
        outcome:
          '你趁山风未起破开岩缝，追至一座半埋在山腹中的旧门。门后传来异响，真正的答案与危险都在关联秘境之中。',
        memorySummary: `${context.cultivator.name}在历练归途果断破开岩缝，发现山道旧痕所指的秘境旧门。`,
        tags: ['云游', '山道', '果断'],
        rewardKind: 'cultivation_exp',
        dungeonBlueprint: {
          title: '旧门追痕',
          theme: `${oldTrace}，半埋旧门后的气息已因强行开启而惊动。`,
          objective: '抢在旧门重新封闭前追至源头，并解决阻断调查的威胁。',
          openingHook:
            '你破开岩缝直入旧门，身后的碎石随即坍落；前方痕迹正向山腹核心迅速退去。',
          primaryClue: '旧门后正在消退的痕迹',
          dangerTone: 'urgent',
        },
      },
    ],
  };
}

function normalizedStoryName(value: string): string {
  return value.replace(/[\s「」【】《》/\\]/gu, '').toLowerCase();
}

export function deriveStoryAftermathPolicy(
  context: StoryDungeonTriggerContext,
  thread: StoryThreadGenerationContext,
): StoryAftermathPolicy {
  const entityName = thread.entity?.name
    ? normalizedStoryName(thread.entity.name)
    : '';
  const entityDefeated = Boolean(
    entityName &&
    context.run.defeatedEnemyNames.some(
      (name) => normalizedStoryName(name) === entityName,
    ),
  );
  const resolutionStatus =
    context.run.outcome === 'completed'
      ? 'resolved'
      : context.run.outcome === 'retreated_after_battle'
        ? 'partial'
        : 'failed';
  return {
    entityDefeated,
    lifeStatus: entityDefeated
      ? 'dead'
      : (thread.entity?.lifeStatus ?? 'active'),
    narratorMode: entityDefeated ? 'system_record' : 'entity_letter',
    resolutionStatus,
  };
}

function validateMemoryRefs(
  refs: readonly string[],
  allowedMemories: readonly StoryMemoryReference[],
): void {
  const allowed = new Set(allowedMemories.map((memory) => memory.id));
  if (refs.some((ref) => !allowed.has(ref))) {
    throw new Error('story generation referenced an unknown memory');
  }
}

export class PersonalStoryGenerator {
  generateMemoryFallback(
    context: StoryDungeonTriggerContext,
  ): StoryMemoryGenerationResult {
    return { output: fallbackMemory(context), source: 'fallback' };
  }

  async generateMemory(
    context: StoryDungeonTriggerContext,
  ): Promise<StoryMemoryGenerationResult> {
    try {
      const { system, user } = renderPrompt('story-memory-extract', {
        payloadJson: stableCompactStringify(authoritativeRunPayload(context)),
      });
      const response = await generateAiObject({
        system,
        prompt: user,
        schema: StoryMemoryGenerationSchema,
        name: 'PersonalStoryMemory',
        sceneId: 'story-memory-extract',
        maxOutputTokens: 500,
        abortSignal: AbortSignal.timeout(STORY_LLM_TIMEOUT_MS),
      });
      return { output: response.output, source: 'llm' };
    } catch (error) {
      return {
        ...this.generateMemoryFallback(context),
        error: errorMessage(error),
      };
    }
  }

  async generateOmen(input: {
    context: StoryDungeonTriggerContext;
    memory: StoryMemoryReference;
    previousMemories: StoryMemoryReference[];
    canonSummary: string;
    relatedEntities: StoryRelatedEntityReference[];
  }): Promise<StoryOmenGenerationResult> {
    const allowedMemories = [input.memory, ...input.previousMemories].slice(
      0,
      6,
    );
    try {
      const { system, user } = renderPrompt('story-beat', {
        frameworkJson: stableCompactStringify(PAST_ECHOES_FRAMEWORK),
        payloadJson: stableCompactStringify({
          task: 'omen',
          cultivator: input.context.cultivator,
          canonSummary: truncateText(input.canonSummary, 800),
          memories: allowedMemories,
          trigger: authoritativeRunPayload(input.context).dungeon,
          allowedChoiceKeys: STORY_LAUNCH_CHOICE_KEY_VALUES,
          relatedEntities: input.relatedEntities,
          introductionPolicy: {
            newEntityMustBeUnverified: true,
            relationshipMustBe: 'unknown',
            deadEntitiesAreHistoricalContextOnly: true,
          },
        }),
      });
      const response = await generateAiObject({
        system,
        prompt: user,
        schema: StoryOmenGenerationSchema,
        name: 'PersonalStoryOmen',
        sceneId: 'story-beat',
        maxOutputTokens: 1_600,
        abortSignal: AbortSignal.timeout(STORY_LLM_TIMEOUT_MS),
      });
      validateMemoryRefs(response.output.memoryRefs, allowedMemories);
      if (
        !isStoryOmenIntroductionConsistent({
          content: response.output.content,
          introductionMode: response.output.entity.introductionMode,
          relationship: response.output.entity.relationship,
        }) ||
        response.output.entity.introductionMode !== 'unverified_claimant'
      ) {
        throw new Error('新故人的过往关系被写成了已证实事实');
      }
      const reusedDeadEntity = input.relatedEntities.some(
        (entity) =>
          entity.lifeStatus === 'dead' &&
          normalizedStoryName(entity.name) ===
            normalizedStoryName(response.output.entity.name),
      );
      if (reusedDeadEntity) {
        throw new Error('已死亡角色不能被当作新来信者');
      }
      const activeDeadEntityMention = input.relatedEntities.some(
        (entity) =>
          entity.lifeStatus === 'dead' &&
          response.output.content.includes(entity.name) &&
          !isDeadStoryEntityMentionHistorical(
            response.output.content,
            entity.name,
          ),
      );
      if (activeDeadEntityMention) {
        throw new Error('已死亡角色被写成了当前存活参与者');
      }
      return { output: response.output, source: 'llm' };
    } catch (error) {
      return {
        output: fallbackOmen(input.context, input.memory),
        source: 'fallback',
        error: errorMessage(error),
      };
    }
  }

  async generateDungeonBlueprint(input: {
    cultivatorName: string;
    memory: StoryMemoryReference;
    thread: StoryThreadGenerationContext;
    choiceKey: Exclude<StoryChoiceKey, 'delay'>;
  }): Promise<StoryBlueprintGenerationResult> {
    try {
      const { system, user } = renderPrompt('story-dungeon-blueprint', {
        payloadJson: stableCompactStringify(input),
      });
      const response = await generateAiObject({
        system,
        prompt: user,
        schema: StoryDungeonBlueprintSchema,
        name: 'PersonalStoryDungeonBlueprint',
        sceneId: 'story-dungeon-blueprint',
        maxOutputTokens: 700,
        abortSignal: AbortSignal.timeout(STORY_LLM_TIMEOUT_MS),
      });
      return { output: response.output, source: 'llm' };
    } catch (error) {
      return {
        output: fallbackBlueprint(input.memory, input.thread, input.choiceKey),
        source: 'fallback',
        error: errorMessage(error),
      };
    }
  }

  async generateAftermath(input: {
    context: StoryDungeonTriggerContext;
    memory: StoryMemoryReference;
    thread: StoryThreadGenerationContext;
  }): Promise<StoryAftermathGenerationResult> {
    const policy = deriveStoryAftermathPolicy(input.context, input.thread);
    try {
      const { system, user } = renderPrompt('story-beat', {
        frameworkJson: stableCompactStringify(PAST_ECHOES_FRAMEWORK),
        payloadJson: stableCompactStringify({
          task: 'aftermath',
          cultivator: input.context.cultivator,
          memory: input.memory,
          thread: input.thread,
          authoritativeSettlement: authoritativeRunPayload(input.context)
            .dungeon,
          aftermathPolicy: policy,
        }),
      });
      const response = await generateAiObject({
        system,
        prompt: user,
        schema: StoryAftermathGenerationSchema,
        name: 'PersonalStoryAftermath',
        sceneId: 'story-beat',
        maxOutputTokens: 1_000,
        abortSignal: AbortSignal.timeout(STORY_LLM_TIMEOUT_MS),
      });
      if (
        response.output.narratorMode !== policy.narratorMode ||
        response.output.resolutionStatus !== policy.resolutionStatus ||
        !isStoryAftermathNarrationConsistent({
          content: response.output.content,
          entityName: input.thread.entity?.name,
          lifeStatus: policy.lifeStatus,
          narratorMode: response.output.narratorMode,
        }) ||
        (policy.entityDefeated && response.output.relationship !== 'hostile')
      ) {
        throw new Error('剧情余波与权威死亡或结算事实冲突');
      }
      return { output: response.output, source: 'llm' };
    } catch (error) {
      return {
        output: fallbackAftermath(input.context, input.thread, policy),
        source: 'fallback',
        error: errorMessage(error),
      };
    }
  }

  async generateActivityStory(input: {
    context: TravelStoryTriggerContext;
    memories: StoryMemoryReference[];
    relatedEntities: StoryRelatedEntityReference[];
    activeThread: StoryThreadGenerationContext | null;
    linkage?: TravelStoryGenerationLinkageContext;
  }): Promise<TravelStoryGenerationResult> {
    const memories = input.memories.slice(0, 6);
    const relatedEntities = input.relatedEntities.slice(0, 3);
    try {
      const { system, user } = renderPrompt('story-activity-event', {
        payloadJson: stableCompactStringify({
          cultivator: input.context.cultivator,
          journey: input.context.journey,
          memories,
          relatedEntities,
          activeThread: input.activeThread,
          linkage: input.linkage ?? null,
        }),
      });
      const response = await generateAiObject({
        system,
        prompt: user,
        schema: TravelStoryGenerationSchema,
        name: 'PersonalStoryTravelEvent',
        sceneId: 'story-activity-event',
        maxOutputTokens: 1_200,
        abortSignal: AbortSignal.timeout(STORY_LLM_TIMEOUT_MS),
      });
      validateMemoryRefs(response.output.memoryRefs, memories);
      const allowedEntityIds = new Set(
        relatedEntities.map((entity) => entity.id),
      );
      if (response.output.entityRefs.some((id) => !allowedEntityIds.has(id))) {
        throw new Error('activity story referenced an unknown entity');
      }
      if (
        input.context.journey.activityType === 'travel' &&
        !input.linkage &&
        response.output.choices.some((choice) => !choice.dungeonBlueprint)
      ) {
        throw new Error('云游异闻没有生成关联秘境蓝图');
      }
      const narrative = [
        response.output.content,
        ...response.output.choices.flatMap((choice) => [
          choice.description,
          choice.outcome,
          choice.memorySummary,
        ]),
      ].join('\n');
      if (TRAVEL_STORY_FORBIDDEN_NARRATIVE.test(narrative)) {
        throw new Error('云游事件越权宣称了奖励数值、具体物品或战斗结果');
      }
      const activeDeadEntityMention = relatedEntities.some(
        (entity) =>
          entity.lifeStatus === 'dead' &&
          narrative.includes(entity.name) &&
          !isDeadStoryEntityMentionHistorical(narrative, entity.name),
      );
      if (activeDeadEntityMention) {
        throw new Error('云游事件把已死亡人物写成了当前参与者');
      }
      return { output: response.output, source: 'llm' };
    } catch (error) {
      return {
        output: fallbackTravelStory(input.context, memories, input.linkage),
        source: 'fallback',
        error: errorMessage(error),
      };
    }
  }

  generateTravelEvent(
    input: Parameters<PersonalStoryGenerator['generateActivityStory']>[0],
  ): Promise<TravelStoryGenerationResult> {
    return this.generateActivityStory(input);
  }
}

export const personalStoryGenerator = new PersonalStoryGenerator();
