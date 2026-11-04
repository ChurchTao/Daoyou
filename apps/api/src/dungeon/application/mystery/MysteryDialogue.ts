import type {
  MysteryCaseFile,
  MysteryRunState,
} from '@daoyou/game-domain/dungeon/mystery';
import { mysteryRevealableSecrets } from '@daoyou/game-rules/dungeon/mystery';
import { renderPrompt } from '@server/lib/prompts/index.js';
import { generateAiObject } from '@server/utils/aiClient.js';
import { stableCompactStringify } from '@server/utils/llmPayload.js';
import { z } from 'zod';
import { cleanMysteryText } from './MysteryCaseReview.js';

/**
 * NPC 自由对话：模型只拿到此人此刻可以说的内情，拿不到真相与未解锁的秘密，
 * 因此即便被话术诱导也无从泄露；它声称透露的线索还会再经规则层过滤。
 */
export async function generateNpcReply(args: {
  caseFile: MysteryCaseFile;
  run: MysteryRunState;
  npcId: string;
  question: string;
}): Promise<{ reply: string; reveal: string[] }> {
  const { caseFile, run, npcId, question } = args;
  const npc = caseFile.npcs.find((n) => n.id === npcId);
  if (!npc) throw new Error('人物不存在');
  const clueText = (id: string) => caseFile.clues.find((c) => c.id === id);
  const canReveal = mysteryRevealableSecrets(caseFile, run, npcId).map((s) => ({
    clueId: s.clueId,
    content: s.line,
  }));
  // 说谎者对外的说法（clue_claim 系列线索），对话中必须与之一致；
  // 谁说谎随案型变体而定，不按身份判断。
  const publicClaim = npc.secrets
    .filter((s) => s.clueId.startsWith('clue_claim'))
    .map((s) => clueText(s.clueId)?.text ?? '')
    .join(' ');
  const prompt = renderPrompt('dungeon-npc', {
    userContextJson: stableCompactStringify({
      npc: {
        name: npc.name,
        title: npc.title,
        voice: [npc.greeting, npc.idleLine, npc.deflectLine],
        publicClaim,
      },
      canReveal,
      scene: {
        opening: caseFile.brief.opening,
        here: caseFile.rooms.find((r) => r.id === run.location)?.name,
        people: caseFile.npcs
          .filter((n) => n.id !== npc.id)
          .map((n) => `${n.name}（${n.title}）`),
        places: caseFile.rooms.map((r) => r.name),
      },
      playerKnows: run.clues
        .map(clueText)
        .filter(Boolean)
        .map((c) => `${c!.name}：${c!.text}`),
      history: run.dialogue?.[npc.id] ?? [],
      question,
    }),
  });
  const allowed = canReveal.map((s) => s.clueId);
  const schema = z.object({
    reply: z.string().describe('以人物口吻的回答，一到三句，120 字以内'),
    reveal:
      allowed.length > 0
        ? z
            .array(z.enum(allowed as [string, ...string[]]))
            .describe('本次回答中说出的内情 clueId；没有则为空数组')
        : z.array(z.string()).max(0).describe('始终为空数组'),
  });
  const { output } = await generateAiObject({
    system: prompt.system,
    prompt: prompt.user,
    schema,
    name: 'DungeonMysteryNpcReply',
    sceneId: 'dungeon-npc',
    timeoutMs: 30_000,
  });
  const reply = cleanMysteryText(output.reply, 200);
  if (!reply) throw new Error('人物没有作答');
  return { reply, reveal: output.reveal };
}
