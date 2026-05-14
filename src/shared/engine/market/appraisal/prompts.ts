import { renderPromptSystem, renderPromptUser } from '@server/lib/prompts';
import type { Material } from '@shared/types/cultivator';

export function getMarketAppraisalPrompt(): string {
  return renderPromptSystem('market-appraisal');
}

export function getMarketAppraisalUserPrompt(material: Material): string {
  return renderPromptUser('market-appraisal', {
    name: material.name,
    type: material.type,
    rank: material.rank,
    element: material.element || '无',
    quantity: material.quantity,
    description: material.description || '无描述',
    details: JSON.stringify(material.details || {}),
  });
}
