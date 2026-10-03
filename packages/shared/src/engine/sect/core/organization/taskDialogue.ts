import type {
  SectTaskDefinition,
  SectTaskDialoguePresentation,
  SectTaskDialogueSegment,
} from './contracts.js';
import type { SectTaskOfferSnapshot } from './taskOffer.js';
import { formatSectDeliveryRequirement } from './taskRequirements.js';

function progressSentence(current: number, target: number): string | undefined {
  if (target <= 1) return undefined;
  if (current >= target) return `功簿上已经记足${target}次，此事可以交回了。`;
  if (current > 0)
    return `功簿上已经记下${current}次，还差${target - current}次。`;
  return `一共需要办妥${target}次，功簿会逐次记下。`;
}

export function resolveSectTaskDialogue(args: {
  definition: SectTaskDefinition;
  offer: SectTaskOfferSnapshot;
  progress: { current: number; target: number };
}): SectTaskDialoguePresentation {
  const dialogue = args.definition.presentation.dialogue;
  const instruction: SectTaskDialogueSegment[] =
    args.offer.requirement && dialogue.instruction.requirementPrefix
      ? [
          { text: dialogue.instruction.requirementPrefix },
          ...formatSectDeliveryRequirement(args.offer.requirement),
          { text: dialogue.instruction.requirementSuffix ?? '。' },
        ]
      : [{ text: dialogue.instruction.text }];
  const progress = progressSentence(
    args.progress.current,
    args.progress.target,
  );
  if (progress) instruction.push({ text: ` ${progress}` });

  return {
    offeredReply: dialogue.offeredReply,
    activeReply: dialogue.activeReply,
    claimableReply: dialogue.claimableReply,
    claimedReply: dialogue.claimedReply,
    instruction,
  };
}
