import { BeastTradeDetails } from '@app/components/feature/beasts/BeastTradePreview';
import { ItemPreviewView } from '@app/components/feature/items/ItemPreviewView';
import { ItemSlot, PreviewSlot } from '@app/components/feature/items/ItemSlot';
import type { ItemPreviewModel } from '@app/components/feature/items/presentation/types';
import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { BEAST_SPECIES } from '@daoyou/game-content/beasts';
import { getGameConceptIcon } from '@daoyou/game-content/presentation/concepts';
import type { MailAttachment } from '@daoyou/game-domain/mail';

export function MailAttachmentSlot({
  attachment,
}: {
  attachment: MailAttachment;
}) {
  if (attachment.type === 'inventory_v1' && attachment.inventory) {
    return (
      <ItemSlot
        quantityLabel="奖励"
        item={{
          name: attachment.name,
          definitionId: attachment.inventory.definitionId,
          instanceData: attachment.inventory.instanceData ?? null,
          quantity: attachment.quantity,
        }}
      />
    );
  }

  if (attachment.type === 'beast_v1' && attachment.beastPreview) {
    const beast = attachment.beastPreview;
    const species = BEAST_SPECIES.find((entry) => entry.id === beast.speciesId);
    return (
      <PreviewSlot
        item={{
          name: attachment.name,
          quantity: attachment.quantity,
          icon: species?.icon ?? '🐾',
          color: 'text-ink',
        }}
        badge={beast.isMutant ? '变异' : undefined}
        renderPreview={() => <BeastTradeDetails beast={beast} />}
      />
    );
  }

  const isVault = ['material', 'consumable', 'artifact'].includes(
    attachment.type,
  );
  const facts = isVault ? attachment.data : undefined;
  const legacySeed =
    attachment.type === 'material' &&
    facts &&
    'type' in facts &&
    facts.type === 'seed';
  const tier = facts && ('rank' in facts ? facts.rank : facts.quality);
  const icon = getGameConceptIcon(attachment.type) || '🎁';
  const color = tier ? tierColorMap[tier] : 'text-ink';
  const model: ItemPreviewModel = {
    title: attachment.name,
    icon,
    titleColor: color,
    header: legacySeed
      ? [
          { kind: 'field', label: '类型', value: `${tier} · 旧灵种` },
          { kind: 'field', label: '功能', value: '材料转化' },
          { kind: 'field', label: '领取去向', value: '储物袋／储藏室' },
        ]
      : isVault
        ? [{ kind: 'field', label: '领取去向', value: '洞府宝库' }]
        : [],
    sections: legacySeed
      ? [
          {
            title: '转化用途',
            entries: [
              {
                kind: 'line',
                value:
                  '旧灵种无法播种，领取后可在旧灵种转化中等量换取同品质的新种子。',
              },
            ],
          },
        ]
      : [],
    description: facts?.description,
  };

  return (
    <PreviewSlot
      item={{
        name: attachment.name,
        quantity: attachment.quantity,
        icon,
        color,
      }}
      renderPreview={(close) => <ItemPreviewView model={model} close={close} />}
    />
  );
}
