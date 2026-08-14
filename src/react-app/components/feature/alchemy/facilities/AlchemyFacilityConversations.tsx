import {
  NpcConversation,
  type NpcConversationOption,
} from '@app/components/feature/room';
import { ALCHEMY_FACILITIES } from '../alchemyFacilities';
import type { AlchemyFacilityAction } from '../alchemyTypes';
import { useAlchemyCraftSession } from '../alchemyCraftContext';

type ConversationProps = {
  onExit(): void;
  onOpen(action: AlchemyFacilityAction): void;
};

export function FurnaceConversation({ onExit, onOpen }: ConversationProps) {
  const session = useAlchemyCraftSession();
  const hasCurrentBatch =
    session.phase !== 'preparing' ||
    session.materials.ids.length > 0 ||
    Boolean(session.formula) ||
    Boolean(session.intent.trim());
  const options: NpcConversationOption[] = [];

  if (hasCurrentBatch) {
    options.push({
      id: 'current',
      label:
        session.phase === 'result'
          ? '查看炼制结果'
          : session.phase === 'observing'
            ? '继续确认本炉'
            : '继续处理当前一炉',
      tone: 'primary',
    });
  }
  options.push(
    { id: 'improvised', label: '随心炼丹' },
    { id: 'formula', label: '按照丹方炼制' },
    { id: 'leave', label: '返回炼丹房', tone: 'muted' },
  );

  return (
    <NpcConversation
      actor={ALCHEMY_FACILITIES.furnace}
      messages={[
        {
          id: 'state',
          body:
            session.phase === 'result'
              ? '炉火已经平息，这一炉的炼制结果正等你查看。'
              : hasCurrentBatch
                ? '炉中已有准备好的材料。你可以继续这一炉，也可以重新选择炼制方式。'
                : '炉火尚未点燃。你可以自由搭配材料，也可以按照已有丹方炼制。',
        },
      ]}
      options={options}
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (
          optionId === 'current' ||
          optionId === 'improvised' ||
          optionId === 'formula'
        )
          onOpen(optionId);
      }}
    />
  );
}

export function HerbCabinetConversation({
  onExit,
  onOpen,
}: ConversationProps) {
  return (
    <NpcConversation
      actor={ALCHEMY_FACILITIES.cabinet}
      messages={[
        {
          id: 'intro',
          body: '药柜中存放着你已有的炼丹材料。可以在这里查看库存和材料药性。',
        },
      ]}
      options={[
        { id: 'materials', label: '查看炼丹材料', tone: 'primary' },
        { id: 'leave', label: '返回炼丹房', tone: 'muted' },
      ]}
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (optionId === 'materials') onOpen(optionId);
      }}
    />
  );
}

export function FormulaArchiveConversation({
  onExit,
  onOpen,
}: ConversationProps) {
  return (
    <NpcConversation
      actor={ALCHEMY_FACILITIES.formulas}
      messages={[
        {
          id: 'intro',
          body: '玉简中记录着你已经掌握的丹方。可以在这里查阅、使用或删除已有丹方。',
        },
      ]}
      options={[
        {
          id: 'formula-library',
          label: '查看已有丹方',
          tone: 'primary',
        },
        { id: 'formula', label: '使用丹方炼制' },
        { id: 'leave', label: '返回炼丹房', tone: 'muted' },
      ]}
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (optionId === 'formula-library' || optionId === 'formula')
          onOpen(optionId);
      }}
    />
  );
}

export function AlchemyGuideConversation({
  onExit,
  onOpen,
}: ConversationProps) {
  return (
    <NpcConversation
      actor={ALCHEMY_FACILITIES.guide}
      messages={[
        {
          id: 'intro',
          body: '石碑记载着炼丹的基本方法和常见问题。阅读碑文不会改变炉中的材料。',
        },
      ]}
      options={[
        {
          id: 'guide-reference',
          label: '阅读炼丹说明',
          tone: 'primary',
        },
        { id: 'leave', label: '返回炼丹房', tone: 'muted' },
      ]}
      onSelectOption={(optionId) => {
        if (optionId === 'leave') onExit();
        else if (
          optionId === 'guide-basics' ||
          optionId === 'guide-reference'
        )
          onOpen(optionId);
      }}
    />
  );
}
