import { BeastTradeDetails } from '@app/components/feature/beasts/BeastTradePreview';
import { ItemPreviewView } from '@app/components/feature/items/ItemPreviewView';
import { ItemSlot, PreviewSlot } from '@app/components/feature/items/ItemSlot';
import type { ItemPreviewModel } from '@app/components/feature/items/presentation/types';
import { tierColorMap } from '@app/components/ui/inkBadgeTiers';
import { BEAST_SPECIES } from '@daoyou/shared/engine/combat-v6/beasts/content';
import { getGameConceptIcon } from '@daoyou/shared/lib/gameConceptDisplay';
import type { MailAttachment } from '@daoyou/shared/types/mail';

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
  const tier = facts && ('rank' in facts ? facts.rank : facts.quality);
  const icon = getGameConceptIcon(attachment.type) || '🎁';
  const color = tier ? tierColorMap[tier] : 'text-ink';
  const model: ItemPreviewModel = {
    title: attachment.name,
    icon,
    titleColor: color,
    header: isVault
      ? [{ kind: 'field', label: '领取去向', value: '洞府宝库' }]
      : [],
    sections: [],
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
