import { InkButton, InkNotice } from '@app/components/ui';
import { sectPresentationRegistry } from '@app/lib/sect/presentation/compositionRoot';
import { createElement } from 'react';
import { useSectTaskInteraction } from './SectTaskInteractionProvider';

export function SectTaskOutcomeHost() {
  const interaction = useSectTaskInteraction();
  if (!interaction.outcome) return null;
  const registry = sectPresentationRegistry();
  const decoded = registry.decode(interaction.outcome.outcome);
  if (!decoded.ok)
    return (
      <InkNotice className="mt-4">
        {decoded.error}
        <InkButton variant="secondary" onClick={interaction.clearOutcome}>
          关闭结果
        </InkButton>
      </InkNotice>
    );
  const contribution = registry.outcome(decoded.value.renderer);
  if (!contribution)
    return (
      <InkNotice className="mt-4">暂不支持此任务结果。</InkNotice>
    );
  return createElement(contribution.renderer, {
    task: interaction.outcome.task,
    data: decoded.value.data,
  });
}
